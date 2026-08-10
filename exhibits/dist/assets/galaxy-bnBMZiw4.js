import{B as e,G as t,L as n,Q as r,Z as i,at as a,ct as o,f as s,ft as c,it as l,l as u,lt as d,n as f,nt as p,p as m,r as h,st as g,t as _,u as v}from"./index-D92r-ptt.js";import{a as y,i as b,n as x,r as S,t as C}from"./UnrealBloomPass-C6TT1zkL.js";var w={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},T=class extends y{constructor(){super(),this.isOutputPass=!0,this.uniforms=i.clone(w.uniforms),this.material=new e({name:w.name,uniforms:this.uniforms,vertexShader:w.vertexShader,fragmentShader:w.fragmentShader}),this._fsQuad=new b(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},m.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},E={class:`relative h-dvh w-full overflow-hidden bg-[#04050d] font-sans`},D={key:0,class:`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-6 pb-9 text-center select-none`},O=_({__name:`galaxy`,props:{bare:Boolean},setup(e){let i=c(null),m=null,_=null,y={branches:2,radius:5,spin:1,randomness:.5,randomnessPower:3,insideColor:new s(`#ffb27d`),outsideColor:new s(`#6b8fe6`),coreColor:new s(`#ffe9c4`)};function b(e){let r=new Float32Array(e*3),i=new Float32Array(e*3),a=new Float32Array(e),o=Math.floor(e*.1),s=Math.floor(e*.08);for(let t=0;t<e;t++){let e=t*3,n,c,l,u;if(t<o){u=Math.abs((Math.random()+Math.random()+Math.random()-1.5)/1.5)*y.radius*.2;let r=Math.random()*Math.PI*2,o=Math.acos(2*Math.random()-1);n=u*Math.sin(o)*Math.cos(r),l=u*Math.sin(o)*Math.sin(r),c=u*Math.cos(o)*.55;let s=y.coreColor.clone().lerp(y.insideColor,u/(y.radius*.2));i[e]=s.r,i[e+1]=s.g,i[e+2]=s.b,a[t]=.5+Math.random()*.7}else if(t<o+s){let r=(Math.random()*2-1)*y.radius*.38,o=.06+.1*(1-Math.abs(r)/(y.radius*.38));n=r,c=(Math.random()*2-1)*y.radius*o*.7,l=(Math.random()*2-1)*y.radius*o;let s=y.coreColor.clone().lerp(y.insideColor,Math.abs(r)/(y.radius*.38));i[e]=s.r,i[e+1]=s.g,i[e+2]=s.b,a[t]=.5+Math.random()*.9}else{u=Math.random()**2*y.radius;let r=t%y.branches/y.branches*Math.PI*2+u*y.spin,o=Math.random()**+y.randomnessPower*(Math.random()<.5?1:-1)*y.randomness*u,s=Math.random()**+y.randomnessPower*(Math.random()<.5?1:-1)*y.randomness*u,d=Math.random()**+y.randomnessPower*(Math.random()<.5?1:-1)*y.randomness*u;n=Math.cos(r)*u+o,l=Math.sin(r)*u+d,c=s*.32;let f=y.insideColor.clone().lerp(y.outsideColor,(u/y.radius)**.8);i[e]=f.r,i[e+1]=f.g,i[e+2]=f.b,a[t]=.4+Math.random()*1.1}r[e]=n,r[e+1]=c,r[e+2]=l}let c=new v;return c.setAttribute(`position`,new u(r,3)),c.setAttribute(`aColor`,new u(i,3)),c.setAttribute(`aScale`,new u(a,1)),new n(c,new t({uniforms:{uSize:{value:22},uPixelRatio:{value:Math.min(window.devicePixelRatio,h()?1.5:2)}},transparent:!0,depthWrite:!1,blending:2,vertexShader:`
      uniform float uSize;
      uniform float uPixelRatio;
      attribute vec3 aColor;
      attribute float aScale;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * aScale * uPixelRatio * (1.0 / -mv.z);
        vColor = aColor;
      }
    `,fragmentShader:`
      varying vec3 vColor;
      void main() {
        // 软圆点：径向衰减（Galaxy Shader 课手法，弃用 PointsMaterial 方点）
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        float strength = pow(1.0 - d * 2.0, 2.5);
        gl_FragColor = vec4(vColor * strength, strength);
      }
    `}))}return o(()=>{document.title=`展品 003 · 亿万星尘`;let e=h();m=f(i.value,{fov:45,cameraPos:[4.2,3,4.2],orbit:{minDistance:2.5,maxDistance:15,autoRotate:!0,autoRotateSpeed:.1},toneExposure:1});let{scene:t,camera:n,renderer:a}=m;t.background=new s(`#04050d`);let o=b(e?5e4:2e5);if(t.add(o),m.onTick(e=>{o.rotation.y+=e*(2*Math.PI/420)}),!e){let e=a.getDrawingBufferSize(new r);_=new S(a),_.addPass(new x(t,n)),_.addPass(new C(new r(e.x/2,e.y/2),.32,.35,.25)),_.addPass(new T),m.setRender(()=>_.render()),m.onResizeFn((e,t)=>_.setSize(e,t))}}),g(()=>{_?.dispose?.(),m?.dispose()}),(t,n)=>(d(),a(`div`,E,[p(`div`,{ref_key:`stageEl`,ref:i,class:`absolute inset-0 touch-none`},null,512),e.bare?l(``,!0):(d(),a(`div`,D,[...n[0]||=[p(`p`,{class:`text-[11px] tracking-[0.55em] text-slate-500`},`EXHIBIT · 003`,-1),p(`h1`,{class:`text-4xl font-bold text-slate-100`},`亿万星尘`,-1),p(`p`,{class:`fade-in text-sm text-slate-300`,style:{"animation-delay":`0.8s`}},` 十万颗星尘在指尖旋转。你也是星尘，恰好会看星星的那种。 `,-1),p(`p`,{class:`fade-in text-xs text-slate-500`,style:{"animation-delay":`1.8s`}},` 拖动环顾，滚轮穿越星海。 `,-1)]])),n[1]||=p(`p`,{class:`absolute right-3 bottom-2 z-10 text-[10px] text-slate-600 select-none`},` three.js · 算法灵感 Three.js Journey「Galaxy Generator」 `,-1)]))}},[[`__scopeId`,`data-v-0d199fe0`]]);export{O as default};