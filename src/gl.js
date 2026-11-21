// Minimal WebGL2 helpers: programs with typed uniform setters, textures, render targets.
export let gl;

const HEADER =
  '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2D;' +
  'precision highp sampler2DArray;precision highp sampler3D;\n';

export function initGL(canvas) {
  gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 is not available on this device or browser.');
  if (!gl.getExtension('EXT_color_buffer_float'))
    throw new Error('This GPU cannot render to floating point targets (EXT_color_buffer_float).');
  gl.getExtension('OES_texture_float_linear');
  gl.pc = gl.getExtension('KHR_parallel_shader_compile');
  return gl;
}

// Fullscreen triangle at the far plane (depth 1), for the sky.
export const SKY_VS = 'out vec2 vUv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.-1.,1,1);}';
// Fullscreen triangle vertex shader (no attributes).
export const FS_VS = 'out vec2 vUv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.-1.,0,1);}';

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

const SETTERS = {
  0x1406: (l, v) => gl.uniform1f(l, v),
  0x8b50: (l, v) => gl.uniform2fv(l, v),
  0x8b51: (l, v) => gl.uniform3fv(l, v),
  0x8b52: (l, v) => gl.uniform4fv(l, v),
  0x1404: (l, v) => (typeof v === 'number' ? gl.uniform1i(l, v) : gl.uniform1iv(l, v)),
  0x8b53: (l, v) => gl.uniform2iv(l, v),
  0x1405: (l, v) => gl.uniform1ui(l, v),
  0x8b5a: (l, v) => gl.uniformMatrix2fv(l, false, v),
  0x8b5b: (l, v) => gl.uniformMatrix3fv(l, false, v),
  0x8b5c: (l, v) => gl.uniformMatrix4fv(l, false, v),
};
const SAMPLERS = new Set([0x8b5e, 0x8dc1, 0x8b5f, 0x8b60, 0x8dca, 0x8dcf]);

// Creates a program. Linking is deferred until first use so the browser can compile in parallel.
export function program(vs, fs, defines = '') {
  const p = gl.createProgram();
  const pre = HEADER + defines;
  const v = compile(gl.VERTEX_SHADER, pre + vs);
  const f = compile(gl.FRAGMENT_SHADER, pre + fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  const o = { p, u: null, ready: () => !gl.pc || gl.getProgramParameter(p, gl.pc.COMPLETION_STATUS_KHR) };
  o.use = (uniforms) => {
    if (!o.u) {
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const log = (s) => gl.getShaderInfoLog(s) || '';
        const msg = log(v) + log(f) + gl.getProgramInfoLog(p);
        console.error(msg, '\n', (pre + fs).split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
        throw new Error('Shader error: ' + msg.slice(0, 400));
      }
      o.u = {};
      o.t = {};
      let unit = 0;
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      gl.useProgram(p);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        const name = info.name.replace(/\[0\]$/, '');
        const loc = gl.getUniformLocation(p, info.name);
        if (SAMPLERS.has(info.type)) {
          gl.uniform1i(loc, unit);
          o.t[name] = unit++;
        } else o.u[name] = [loc, SETTERS[info.type]];
      }
    }
    gl.useProgram(p);
    if (uniforms) o.set(uniforms);
    return o;
  };
  o.set = (uniforms) => {
    for (const k in uniforms) {
      const val = uniforms[k];
      if (k in o.t) {
        gl.activeTexture(gl.TEXTURE0 + o.t[k]);
        gl.bindTexture(val.target || gl.TEXTURE_2D, val.tex || val);
      } else if (k in o.u) o.u[k][1](o.u[k][0], val);
    }
    return o;
  };
  return o;
}

// Texture with given internal format. dims: [w,h] (2D), [w,h,d] with kind '3d' or 'array'.
export function texture(dims, ifmt, fmt, type, filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, kind = '2d') {
  const target = kind === '3d' ? gl.TEXTURE_3D : kind === 'array' ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
  const tex = gl.createTexture();
  gl.bindTexture(target, tex);
  if (dims.length === 3) gl.texStorage3D(target, 1, ifmt, dims[0], dims[1], dims[2]);
  else gl.texStorage2D(target, 1, ifmt, dims[0], dims[1]);
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrap);
  if (dims.length === 3) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  return { tex, target, w: dims[0], h: dims[1], d: dims[2] || 1 };
}

// Render target with one or more 2D color textures and optional depth texture.
export function target(w, h, colors, depth = false) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const tex = colors.map(([ifmt, fmt, type, filter], i) => {
    const t = texture([w, h], ifmt, fmt, type, filter || gl.LINEAR);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.tex, 0);
    return t;
  });
  let dtex = null;
  if (depth) {
    dtex = texture([w, h], gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dtex.tex, 0);
  }
  gl.drawBuffers(colors.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    fb, tex, depth: dtex, w, h,
    free() {
      gl.deleteFramebuffer(fb);
      tex.forEach((t) => gl.deleteTexture(t.tex));
      if (dtex) gl.deleteTexture(dtex.tex);
    },
  };
}

export function bindTarget(t) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
  gl.viewport(0, 0, t ? t.w : gl.canvas.width, t ? t.h : gl.canvas.height);
}

let emptyVAO;
export function fullscreen() {
  if (!emptyVAO) emptyVAO = gl.createVertexArray();
  gl.bindVertexArray(emptyVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// Common texture format shorthands.
export const F = {
  rgba16f: () => [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT],
  r16f: () => [gl.R16F, gl.RED, gl.HALF_FLOAT],
  rg16f: () => [gl.RG16F, gl.RG, gl.HALF_FLOAT],
  r32f: () => [gl.R32F, gl.RED, gl.FLOAT],
  rgba8: () => [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
  r8: () => [gl.R8, gl.RED, gl.UNSIGNED_BYTE],
};
