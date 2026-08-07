import{a as e,c as t,f as n,i as r,l as i,n as a,s as o}from"./index-DBH_9wYQ.js";import{E as s,S as c,b as l,d as u,f as d,l as f,p,r as m,t as h,v as g,x as _}from"./threeStage-BYIb9dXU.js";import{t as v}from"./_plugin-vue_export-helper-BDNMzG2s.js";var y={class:`relative h-dvh w-full overflow-hidden bg-[#04060e] font-sans`},b={key:0,class:`absolute inset-0 z-10 flex items-center justify-center text-xs tracking-[0.4em] text-slate-500 select-none`},x={key:1,class:`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-6 pb-9 text-center select-none`},S=v({__name:`earth`,props:{bare:Boolean},setup(v){let S=n(null),C=n(!1),w=null;return t(()=>{document.title=`展品 002 · 蓝色弹珠`,w=h(S.value,{fov:38,cameraPos:[0,.7,3.2],orbit:{minDistance:1.7,maxDistance:6,autoRotate:!0,autoRotateSpeed:.2},toneExposure:1.2});let{scene:e}=w,t=new c(new u(()=>{C.value=!0})),n=e=>{let n=t.load(m(e));return n.colorSpace=g,n.anisotropy=8,n},r=n(`earth-day.jpg`),i=n(`earth-night.jpg`),a=n(`2k_earth_clouds.jpg`),o=n(`night-sky.jpg`);o.mapping=303,e.background=o,e.backgroundIntensity=.5;let v=new s(2.5,1.4,4.2).normalize(),y=new f;y.rotation.z=d.degToRad(23.4),e.add(y);let b=new l({uniforms:{dayMap:{value:r},nightMap:{value:i},sunDirection:{value:v}},vertexShader:`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,fragmentShader:`
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 sunDirView = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
        float sunDot = dot(n, sunDirView);

        // 昼夜混合：晨昏线 ±0.12 柔边（官方 tsl_earth 同款 smoothstep）
        float dayMix = smoothstep(-0.12, 0.12, sunDot);
        vec3 day = texture2D(dayMap, vUv).rgb * 1.15;
        vec3 night = texture2D(nightMap, vUv).rgb * 1.8; // 夜图偏暗，提亮城市灯光
        vec3 col = mix(night, day, dayMix) + vec3(0.015, 0.02, 0.035); // 微弱环境光防死黑

        // 晨昏线一抹暮光橙
        float twilight = smoothstep(-0.28, 0.0, sunDot) * (1.0 - smoothstep(0.0, 0.28, sunDot));
        col += vec3(0.9, 0.42, 0.12) * twilight * 0.10;

        // 地表边缘 fresnel 蓝雾（昼侧强、夜侧保留一点）
        float fres = pow(1.0 - abs(dot(n, normalize(vViewDir))), 2.5);
        col += vec3(0.35, 0.6, 1.0) * fres * 0.28 * max(dayMix, 0.12);

        gl_FragColor = vec4(col, 1.0);
      }
    `}),x=new p(new _(1,96,96),b);y.add(x);let T=new l({uniforms:{cloudMap:{value:a},sunDirection:{value:v}},transparent:!0,depthWrite:!1,vertexShader:`
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform sampler2D cloudMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        float a = texture2D(cloudMap, vUv).r;
        vec3 n = normalize(vNormal);
        vec3 sunDirView = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
        float light = smoothstep(-0.15, 0.2, dot(n, sunDirView)) * 0.92 + 0.08;
        gl_FragColor = vec4(vec3(light), a * 0.85);
      }
    `}),E=new p(new _(1.012,96,96),T);y.add(E);let D=new l({uniforms:{sunDirection:{value:v}},side:1,blending:2,transparent:!0,depthWrite:!1,vertexShader:`
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform vec3 sunDirection;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float rim = pow(0.62 - dot(n, vec3(0.0, 0.0, 1.0)), 2.0);
        vec3 sunDirView = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
        float daySide = 0.45 + 0.55 * smoothstep(-0.4, 0.4, dot(n, sunDirView));
        vec3 col = vec3(0.38, 0.66, 1.0) * 1.15;
        gl_FragColor = vec4(col, 1.0) * rim * daySide;
      }
    `}),O=new p(new _(1.06,96,96),D);e.add(O),w.onTick(e=>{x.rotation.y+=e*(2*Math.PI/300),E.rotation.y+=e*(2*Math.PI/300)*1.05})}),o(()=>{w?.dispose()}),(t,n)=>(i(),e(`div`,y,[a(`div`,{ref_key:`stageEl`,ref:S,class:`absolute inset-0 touch-none`},null,512),C.value?r(``,!0):(i(),e(`div`,b,` 正在装载星光… `)),v.bare?r(``,!0):(i(),e(`div`,x,[...n[0]||=[a(`p`,{class:`text-[11px] tracking-[0.55em] text-slate-500`},`EXHIBIT · 002`,-1),a(`h1`,{class:`text-4xl font-bold text-slate-100`},`蓝色弹珠`,-1),a(`p`,{class:`fade-in text-sm text-slate-300`,style:{"animation-delay":`0.8s`}},` 1972 年，阿波罗 17 号回头看了一眼。此后我们都住在那张照片里。 `,-1),a(`p`,{class:`fade-in text-xs text-slate-500`,style:{"animation-delay":`1.8s`}},` 拖动，转动这颗星球；滚轮，靠近一点。 `,-1)]])),n[1]||=a(`p`,{class:`absolute right-3 bottom-2 z-10 text-[10px] text-slate-600 select-none`},` three.js · 贴图 NASA Blue Marble（公有领域）/ three-globe（MIT）/ Solar System Scope（CC BY 4.0） `,-1)]))}},[[`__scopeId`,`data-v-e8af9874`]]);export{S as default};