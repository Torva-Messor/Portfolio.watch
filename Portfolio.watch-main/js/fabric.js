export class SilkSurface {
  constructor(webglCanvas, fallbackCanvas, options = {}) {
    this.canvas = webglCanvas;
    this.fallbackCanvas = fallbackCanvas;
    this.options = { mobileScale: 0.7, ...options };
    this.time = 0;
    this.scrollEnergy = 0;
    this.mouse = { x: .5, y: .5 };
    this.targetMouse = { x: .5, y: .5 };
    this.ready = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.gl = null;
    this.program = null;
    this.buffers = {};
    this.uniforms = {};
    this.fallbackCtx = null;
    this.fallbackWidth = 0;
    this.fallbackHeight = 0;
    this._resize = () => this.resize();
    this._contextLost = (e) => { e.preventDefault(); this._activateFallback('context lost'); };
    this._init();
    addEventListener('resize', this._resize, { passive:true });
    window.visualViewport?.addEventListener('resize', this._resize, { passive:true });
    this.canvas.addEventListener('webglcontextlost', this._contextLost, false);
  }

  _compile(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log || 'Shader compilation failed');
    }
    return shader;
  }

  _init() {
    try {
      const gl = this.canvas.getContext('webgl', {
        alpha:false, antialias:true, depth:true, powerPreference:'high-performance'
      }) || this.canvas.getContext('experimental-webgl');
      if (!gl) throw new Error('WebGL unavailable');
      this.gl = gl;

      const vs = `
        precision highp float;
        attribute vec2 aPosition;
        uniform highp float uTime;
        uniform float uScroll;
        uniform vec2 uMouse;
        varying vec2 vUv;
        varying float vHeight;
        varying vec3 vNormal;
        varying float vFoldPhase;

        float silkHeight(vec2 p, float t){
          // Broad, low-frequency folds: liquid satin, not woven textile.
          vec2 warp = vec2(
            sin(p.y * 0.22 + t * 0.10) * 0.72 + sin(p.y * 0.075 - t * 0.045) * 0.46,
            sin(p.x * 0.17 - t * 0.075) * 0.62 + sin(p.x * 0.055 + t * 0.035) * 0.42
          );
          vec2 q = p + warp;
          float phaseA = q.x * 0.48 + sin(q.y * 0.18 + t * 0.075) * 1.45
                       + sin(q.y * 0.065 - t * 0.04) * 0.72 - t * 0.105;
          float phaseB = q.y * 0.33 - q.x * 0.16 + sin(q.x * 0.19 - t * 0.055) * 0.92 + t * 0.055;
          float broadFold = sin(phaseA);
          float crossFold = sin(phaseB);
          float longUndulation = sin(phaseA * 0.54 + phaseB * 0.34 + t * 0.025);
          float z = broadFold * 0.30 + crossFold * 0.10 + longUndulation * 0.045;

          // Pointer motion gently bends the folds instead of forming a local ripple ring.
          vec2 mouse = (uMouse - 0.5) * vec2(13.6, 10.4);
          vec2 drag = q - mouse;
          float influence = exp(-dot(drag, drag) * 0.12);
          z += sin(phaseA + drag.y * 0.12 - t * 0.12) * influence * 0.025;

          float scrollWave = sin(q.x * 0.30 + q.y * 0.18 - t * 0.07);
          z += uScroll * scrollWave * 0.025;
          return z * ${this.reduced ? '0.34' : '1.0'};
        }

        void main(){
          vec2 uv=aPosition*.5+.5;
          vec2 p=vec2(aPosition.x*6.8,aPosition.y*5.2);
          float t=uTime;
          float z=silkHeight(p,t);
          float e=.012;
          float zx=silkHeight(p+vec2(e,0.0),t)-silkHeight(p-vec2(e,0.0),t);
          float zy=silkHeight(p+vec2(0.0,e),t)-silkHeight(p-vec2(0.0,e),t);
          vec3 n=normalize(vec3(-zx*2.0,-zy*2.0,2.0*e));

          vUv=uv;
          vHeight=z;
          vNormal=n;
          vFoldPhase = p.x * 0.48 + sin(p.y * 0.18 + t * 0.075) * 1.45 + sin(p.y * 0.065 - t * 0.04) * 0.72 - t * 0.105;
          // Keep the surface mesh pinned to the viewport edges. Fold depth changes only
          // the lighting/normals; clip-space XY must never shrink away from top/bottom.
          gl_Position=vec4(aPosition,0.0,1.0);
        }
      `;

      const fs = `
        precision highp float;
        uniform highp float uTime;
        varying vec2 vUv;
        varying float vHeight;
        varying vec3 vNormal;
        varying float vFoldPhase;

        void main(){
          vec3 N = normalize(vNormal);
          vec3 V = vec3(0.0, 0.0, 1.0);
          vec3 L = normalize(vec3(-0.42, 0.76, 1.0));
          vec3 L2 = normalize(vec3(0.72, -0.34, 0.68));
          float diffuse = max(dot(N, L), 0.0);
          float fill = max(dot(N, L2), 0.0);
          float sheen = pow(max(dot(reflect(-L, N), V), 0.0), 18.0);

          // Long, restrained specular ribbons ride the broad surface folds.
          float ribbon = 0.5 + 0.5 * cos(vFoldPhase + sin(vUv.y * 5.4 + uTime * 0.05) * 0.34);
          float satinBand = pow(max(ribbon, 0.0), 12.0);
          float softBand = smoothstep(0.18, 0.92, ribbon);
          float heightShade = smoothstep(-0.34, 0.28, vHeight);

          vec3 shadowTone = vec3(0.70, 0.69, 0.66);
          vec3 pearlTone = vec3(0.965, 0.957, 0.936);
          vec3 base = mix(shadowTone, pearlTone, heightShade);
          base += diffuse * 0.075 + fill * 0.035;
          base += softBand * 0.025 + satinBand * 0.16 + sheen * 0.14;
          base -= (1.0 - softBand) * 0.018;
          gl_FragColor = vec4(clamp(base, 0.0, 1.0), 1.0);
        }
      `;

      const program=gl.createProgram();
      gl.attachShader(program,this._compile(gl.VERTEX_SHADER,vs));
      gl.attachShader(program,this._compile(gl.FRAGMENT_SHADER,fs));
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'WebGL link failed');
      this.program=program;

      const mobile=innerWidth<900;
      const nx=mobile?110:190, ny=mobile?74:112;
      const vertices=[];
      for(let y=0;y<=ny;y++) for(let x=0;x<=nx;x++) vertices.push(x/nx*2-1,y/ny*2-1);
      const indices=[];
      for(let y=0;y<ny;y++) for(let x=0;x<nx;x++){
        const i=y*(nx+1)+x;
        indices.push(i,i+1,i+nx+1,i+1,i+nx+2,i+nx+1);
      }

      this.buffers.position=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers.position);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
      this.buffers.index=gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.buffers.index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
      this.indexCount=indices.length;
      this.attrib=gl.getAttribLocation(program,'aPosition');
      this.uniforms.time=gl.getUniformLocation(program,'uTime');
      this.uniforms.scroll=gl.getUniformLocation(program,'uScroll');
      this.uniforms.mouse=gl.getUniformLocation(program,'uMouse');
      this.ready=true;
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(.956,.945,.918,1);
      this.resize();
      document.body.classList.add('webgl-ready');
    } catch(err) {
      console.warn('Silk WebGL failed:',err);
      this._activateFallback(err?.message||'unavailable');
    }
  }

  _activateFallback(reason='unavailable'){
    this.ready=false;
    document.body.classList.remove('webgl-ready');
    document.body.classList.add('silk-fallback-active');
    document.querySelector('#webgl-warning')?.removeAttribute('hidden');
    this.fallbackCtx=this.fallbackCanvas.getContext('2d');
    this._resizeFallback();
  }

  _resizeFallback(){
    if(!this.fallbackCtx)return;
    const rect=this.fallbackCanvas.getBoundingClientRect();
    const w=Math.max(1,Math.ceil(rect.width||innerWidth));
    const h=Math.max(1,Math.ceil(rect.height||innerHeight));
    if(w===this.fallbackWidth&&h===this.fallbackHeight)return;
    const d=Math.min(devicePixelRatio||1,1.5);
    this.fallbackCanvas.width=Math.max(1,Math.ceil(w*d));
    this.fallbackCanvas.height=Math.max(1,Math.ceil(h*d));
    this.fallbackCtx.setTransform(d,0,0,d,0,0);
    this.fallbackWidth=w;this.fallbackHeight=h;
  }

  setMouse(x, y) {
    this.targetMouse.x = x;
    this.targetMouse.y = y;
  }

  addScrollImpulse(value) {
    this.scrollEnergy = Math.min(1, this.scrollEnergy + Math.abs(value) * 0.07);
  }

  update(now,delta){
    const dt=Math.min(delta,50)/1000;
    const speed=this.reduced?.18:1;
    this.time += dt*speed;
    this.scrollEnergy += (0-this.scrollEnergy)*(1-Math.pow(.001,dt));
    const mouseEase=1-Math.pow(.0001,dt);
    this.mouse.x += (this.targetMouse.x-this.mouse.x)*mouseEase;
    this.mouse.y += (this.targetMouse.y-this.mouse.y)*mouseEase;

    if(!this.ready){this._drawFallback();return}
    const gl=this.gl;
    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.time,this.time);
    gl.uniform1f(this.uniforms.scroll,this.scrollEnergy);
    gl.uniform2f(this.uniforms.mouse,this.mouse.x,this.mouse.y);
  }

  _drawFallback() {
    if (!this.fallbackCtx) return;
    const rect = this.fallbackCanvas.getBoundingClientRect();
    if (this.fallbackWidth !== Math.ceil(rect.width || innerWidth)
      || this.fallbackHeight !== Math.ceil(rect.height || innerHeight)) this._resizeFallback();

    const ctx = this.fallbackCtx;
    const width = this.fallbackWidth;
    const height = this.fallbackHeight;
    const time = this.time;
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, '#fbfaf6');
    base.addColorStop(0.36, '#e4e0d7');
    base.addColorStop(0.68, '#f6f3ed');
    base.addColorStop(1, '#e9e5dc');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    // Soft, overlapping gradients suggest a single sheet of polished satin.
    const glow = ctx.createRadialGradient(width * 0.29, height * 0.22, 0, width * 0.29, height * 0.22, Math.max(width, height) * 0.82);
    glow.addColorStop(0, 'rgba(255,255,255,.68)');
    glow.addColorStop(0.42, 'rgba(255,255,255,.12)');
    glow.addColorStop(1, 'rgba(88,82,72,.12)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'soft-light';
    const bandCount = 7;
    for (let fold = -1; fold < bandCount; fold++) {
      const home = height * (fold / (bandCount - 1));
      const phase = time * (0.075 + (fold % 3) * 0.012) + fold * 1.35;
      const wave = (x) => home
        + Math.sin(x * 0.0022 + phase) * height * 0.105
        + Math.sin(x * 0.00105 - phase * 0.55) * height * 0.052
        + Math.sin(x * 0.0040 + phase * 0.35) * height * 0.012;

      ctx.beginPath();
      for (let x = -80; x <= width + 80; x += 18) {
        const y = wave(x);
        if (x === -80) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const shadow = ctx.createLinearGradient(0, home - height * 0.08, 0, home + height * 0.08);
      shadow.addColorStop(0, 'rgba(255,255,255,0)');
      shadow.addColorStop(0.38, 'rgba(255,255,255,.06)');
      shadow.addColorStop(0.56, 'rgba(76,70,60,.12)');
      shadow.addColorStop(0.78, 'rgba(255,255,255,.06)');
      shadow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = shadow;
      ctx.lineWidth = Math.max(28, height * 0.075);
      ctx.stroke();

      ctx.beginPath();
      for (let x = -80; x <= width + 80; x += 18) {
        const y = wave(x) - height * 0.018;
        if (x === -80) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const highlight = ctx.createLinearGradient(0, home - height * 0.06, 0, home + height * 0.04);
      highlight.addColorStop(0, 'rgba(255,255,255,0)');
      highlight.addColorStop(0.48, 'rgba(255,255,255,.03)');
      highlight.addColorStop(0.60, 'rgba(255,255,255,.38)');
      highlight.addColorStop(0.73, 'rgba(255,255,255,.05)');
      highlight.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = highlight;
      ctx.lineWidth = Math.max(2.5, height * 0.008);
      ctx.stroke();
    }
    ctx.restore();
  }

  resize() {
    if (!this.ready) {
      this._resizeFallback();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width || innerWidth));
    const height = Math.max(1, Math.ceil(rect.height || innerHeight));
    const ratio = Math.min(devicePixelRatio || 1, width < 900 ? 0.95 : 1.35);
    this.canvas.width = Math.max(1, Math.ceil(width * ratio));
    this.canvas.height = Math.max(1, Math.ceil(height * ratio));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.useProgram(this.program);
  }

  render() {
    if (!this.ready) return;

    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
    gl.enableVertexAttribArray(this.attrib);
    gl.vertexAttribPointer(this.attrib, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  destroy() {
    removeEventListener('resize', this._resize);
    window.visualViewport?.removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('webglcontextlost', this._contextLost);
    this.gl?.deleteProgram(this.program);
  }
}
