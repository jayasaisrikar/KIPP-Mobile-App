'use dom';

import React, { useEffect, useRef, useState } from 'react';
import { Asset } from 'expo-asset';

const artwork = Asset.fromModule(require('../../../assets/kipp-glass-orb.png')).uri;
const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// Advect the glass artwork through a changing flow field. The outer rim stays
// anchored while interior refraction, folds and specular ribbons move independently.
const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D glass;
uniform float time;
uniform float energy;
varying vec2 uv;
void main() {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float interior = 1.0 - smoothstep(0.25, 0.95, r);
  float t = time;
  float angle = interior * (0.28 * sin(t * 0.57 + r * 4.0) + 0.13 * cos(t * 0.38 - p.y * 3.0));
  float c = cos(angle), s = sin(angle);
  vec2 q = mat2(c, -s, s, c) * p;
  vec2 flow = vec2(
    sin(q.y * 5.0 + t * 0.91 + sin(q.x * 3.0 - t * 0.47)),
    cos(q.x * 4.5 - t * 0.73 + cos(q.y * 3.5 + t * 0.41))
  );
  q += flow * interior * (0.115 + energy * 0.045);
  q += interior * 0.025 * vec2(sin(q.y * 10.0 - t * 1.1), cos(q.x * 9.0 + t));
  vec4 color = texture2D(glass, q * 0.5 + 0.5);
  float sheen = 1.0 + interior * 0.065 * sin(q.x * 6.0 + q.y * 3.0 + t * 0.8);
  gl_FragColor = vec4(color.rgb * sheen, color.a);
}`;

type Props = {
  size: number;
  phase: string;
  running: boolean;
  reducedMotion: boolean;
  dom?: import('expo/dom').DOMProps;
};

export default function FluidOrb({ size, phase, running, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const timeRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) return; // The glass artwork remains visible if WebGL is unavailable.
    setReady(false);
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * density);
    canvas.height = Math.round(size * density);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Unable to allocate orb shader');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Orb shader compilation failed');
      return shader;
    };
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let texture: WebGLTexture | null = null;
    let frame = 0;
    let disposed = false;
    let loaded = false;
    let previous = 0;
    let energy = 0;
    const image = new window.Image();
    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(frame);
      image.onload = null;
      image.onerror = null;
      if (texture) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach((shader) => gl.deleteShader(shader));
    };
    try {
      program = gl.createProgram();
      if (!program) throw new Error('Unable to allocate orb program');
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Orb shader linking failed');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, 'glass'), 0);
      const timeLocation = gl.getUniformLocation(program, 'time');
      const energyLocation = gl.getUniformLocation(program, 'energy');
      const draw = (now: number) => {
        if (disposed || !loaded || gl.isContextLost()) return;
        const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
        previous = now;
        const active = ['listening', 'speaking', 'thinking'].includes(phaseRef.current);
        energy += ((active ? 1 : 0) - energy) * Math.min(dt * 3, 1);
        if (!reducedMotion && running && !document.hidden) timeRef.current += dt * (0.85 + energy * 0.7);
        gl.uniform1f(timeLocation, reducedMotion ? 0 : timeRef.current);
        gl.uniform1f(energyLocation, reducedMotion ? 0 : energy);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (running && !reducedMotion && !document.hidden) frame = requestAnimationFrame(draw);
      };
      const resume = () => {
        cancelAnimationFrame(frame);
        previous = 0;
        if (!document.hidden) draw(performance.now());
      };
      const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); setReady(false); };
      const restored = () => setGeneration((value) => value + 1);
      canvas.addEventListener('webglcontextlost', lost);
      canvas.addEventListener('webglcontextrestored', restored);
      document.addEventListener('visibilitychange', resume);
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (disposed) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Power-of-two texture permits mipmaps on WebGL 1, keeping fine
        // highlights smooth when the 1254px artwork is drawn at mobile size.
        const mipSource = document.createElement('canvas');
        mipSource.width = mipSource.height = 1024;
        const context = mipSource.getContext('2d');
        if (!context) return;
        context.drawImage(image, 0, 0, 1024, 1024);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mipSource);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        loaded = true;
        draw(performance.now());
        setReady(true);
      };
      image.onerror = () => console.warn('Fluid orb texture could not load; using artwork fallback.');
      image.src = artwork;
      return () => {
        canvas.removeEventListener('webglcontextlost', lost);
        canvas.removeEventListener('webglcontextrestored', restored);
        document.removeEventListener('visibilitychange', resume);
        cleanup();
      };
    } catch (error) {
      console.warn('Fluid orb renderer unavailable:', error);
      cleanup();
    }
  }, [size, running, reducedMotion, generation]);

  return (
    <div aria-hidden="true" style={{ width: size, height: size, position: 'relative', overflow: 'hidden', background: 'transparent', pointerEvents: 'none' }}>
      {/* Keep the bundled art visible during texture load or GPU unavailability. */}
      <img src={artwork} alt="" style={{ position: 'absolute', width: '100%', height: '100%', display: ready ? 'none' : 'block' }} />
      <canvas ref={canvasRef} data-testid="fluid-orb" style={{ width: size, height: size, display: 'block', opacity: ready ? 1 : 0 }} />
    </div>
  );
}
