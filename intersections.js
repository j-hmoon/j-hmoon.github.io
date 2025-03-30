
import { resizeAspectRatio, setupText, updateText, Axes } from './util/util.js';
import { Shader, readShaderFile } from './util/shader.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;
let shader;
let vao;
let positionBuffer;
let isCircleDragging = false;
let isLineDragging = false;
let startPoint = null;
let tempEndPoint = null;
let lines = [];
let textOverlay1;
let textOverlay2;
let textOverlay3;
let axes = new Axes(gl, 0.85);
let isDrawingCircle = true;
let Center = null;
let Radius = 0;
let intersectionPoints = [];


function calculateIntersection() {
    if (!Center || lines.length === 0) return [];
    const [cx, cy] = Center;
    const r = Radius;
    const [x1, y1, x2, y2] = lines[0];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return [];

    const result = [];
    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    if (t1 >= 0 && t1 <= 1) result.push([x1 + t1 * dx, y1 + t1 * dy]);
    if (t2 >= 0 && t2 <= 1 && discriminant !== 0) result.push([x1 + t2 * dx, y1 + t2 * dy]);

    return result;
}


document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { 
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;

    resizeAspectRatio(gl, canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
}


function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,
        -((y / canvas.height) * 2 - 1)
    ];
}


function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault();
        event.stopPropagation();

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let [glX, glY] = convertToWebGLCoordinates(x, y);

        if (isDrawingCircle) {
            Center = [glX, glY];
            isCircleDragging = true;
        }
        else if (isDrawingCircle === false && lines.length < 1) {
            startPoint = [glX, glY];
            isLineDragging = true;
        }
    }

    function handleMouseMove(event) {
        if (!isCircleDragging && !isLineDragging) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let [glX, glY] = convertToWebGLCoordinates(x, y);
        if (isCircleDragging) {
            const dx = glX - Center[0];
            const dy = glY - Center[1];
            Radius = Math.sqrt(dx*dx + dy*dy);
        }
        else if (isLineDragging) {
            tempEndPoint = [glX, glY];
        }
            render();
    }

    function handleMouseUp() {
        if (isCircleDragging) {
            updateText(textOverlay1, "Circle: center (" + Center[0].toFixed(2) + ", " + Center[1].toFixed(2) + ") radius = " + Radius.toFixed(2));
            isDrawingCircle = false;
            isCircleDragging = false;
        }
        else if (isLineDragging) {
            lines.push([...startPoint, ...tempEndPoint]);
            updateText(textOverlay2, "Line segment: (" + startPoint[0].toFixed(2) + ", " + startPoint[1].toFixed(2) + ") ~ (" + tempEndPoint[0].toFixed(2) + ", " + tempEndPoint[1].toFixed(2) + ")")
            intersectionPoints = calculateIntersection();
            if (intersectionPoints.length === 0) {
                updateText(textOverlay3, "No intersection");
            }
            else if (intersectionPoints.length === 1) {
                updateText(textOverlay3, "Intersection Points: 1 Point 1: (" + intersectionPoints[0][0].toFixed(2) + ", " + intersectionPoints[0][1].toFixed(2) + ")");
            }
            else if (intersectionPoints.length === 2) {
                updateText(textOverlay3, "Intersection Points: 2 Point 1: (" + intersectionPoints[0][0].toFixed(2) + ", " + intersectionPoints[0][1].toFixed(2) + ") Point 2: (" + intersectionPoints[1][0].toFixed(2) + ", " +intersectionPoints[1][1].toFixed(2) + ")");
            }
            isLineDragging = false;
            }
        
            render();
        }
    

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    shader.use();

    // Draw circle
    if (Center && Radius > 0) {
        shader.setVec4("u_Color", [0.0, 0.6, 1.0, 1.0]);
        const circleVertices = [];
        const segments = 100;
        for (let i = 0; i <= segments; ++i) {
            const angle = (i / segments) * 2 * Math.PI;
            const x = Center[0] + Math.cos(angle) * Radius;
            const y = Center[1] + Math.sin(angle) * Radius;
            circleVertices.push(x, y);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINE_LOOP, 0, segments + 1);
    }

    // Draw line segment
    if (lines.length > 0) {
        shader.setVec4("u_Color", [1.0, 0.0, 0.0, 1.0]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines[0]), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    if (isLineDragging && startPoint && tempEndPoint) {
        shader.setVec4("u_Color", [1.0, 0.0, 0.0, 1.0]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...startPoint, ...tempEndPoint]), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    // Draw intersection points
    if (intersectionPoints.length > 0) {
        shader.setVec4("u_Color", [1.0, 1.0, 0.0, 1.0]);
        intersectionPoints.forEach((p) => {
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.STATIC_DRAW);
            gl.bindVertexArray(vao);
            gl.drawArrays(gl.POINTS, 0, 1);
        });
    }
    
    axes.draw(mat4.create(), mat4.create());
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        await initShader();

        setupBuffers();
        shader.use();

        textOverlay1 = setupText(canvas, "", 1);
        textOverlay2 = setupText(canvas, "", 2);
        textOverlay3 = setupText(canvas, "", 3)

        setupMouseEvents();

        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
