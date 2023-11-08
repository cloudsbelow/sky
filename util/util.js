function m4_ident(){
  return new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
  ]);
}

function m4_mul(a,b){
  let c=new Float32Array(16);
  for(let i=0; i<4; i++){
    for(let j=0; j<4; j++){
      let s=0;
      for(let k=0; k<4; k++){
        s+=a[i*4+k]*b[j+k*4]
      }
      c[i*4+j]=s;
    }
  }
  return c;
}

function m4_vmul(a,x){
  return new Float32Array([
    v_dot([a[0],a[1],a[2],a[3]],x),
    v_dot([a[4],a[5],a[6],a[7]],x),
    v_dot([a[8],a[9],a[10],a[11]],x),
    v_dot([a[12],a[13],a[14],a[15]],x)
  ]);
}

function f_gauss(){
  const u = 1 - Math.random(); // Converting [0,1) to (0,1]
  const v = Math.random();
  return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

function n_gauss(n){
  let c=new Float32Array(n);
  for(let i=0; i<n; i++){
    c[i]=f_gauss();
  }
  return c;
}

function v_fma(a,coef,b=0){
  let c=new Float32Array(a.length);
  for(let i=0; i<a.length; i++){
    c[i]=a[i]*coef+b;
  }
  return c
}

function v_dot(a,b){
  if(a.length!=b.length){
    throw new Error("invalid dot product- lengths do not match");
  }
  let s=0;
  for(let i=0; i<a.length; i++){
    s+=a[i]*b[i];
  }
  return s;
}

function v_norm(a){
  let s=0;
  for(let i=0; i<a.length; i++){
    s+=a[i]*a[i];
  }
  return v_fma(a,1/Math.sqrt(s));
}

function magn(a, l=2){
  let s=0;
  for(let i=0; i<a.length; i++){
    s+=Math.pow(a[i],l);
  }
  return Math.pow(s,1/l);
}

function v_proj(a,b){ //onto a
  let a_=v_norm(a);
  return v_fma(a_, v_dot(a_,b))
}

function v_lop(){
  let c=new Float32Array(arguments[1].length);
  for(let i=0; i<arguments.length; i+=2){
    if(arguments[i+1].length!=c.length){
      throw new Error("invalid linear op- jagged inputs");
    }
    for(let j=0; j<c.length; j++){
      c[j]+=arguments[i+1][j]*arguments[i];
    }
  }
  return c;
}

function m4_t(a){
  return new Float32Array([ //strictly faster than a forloop but actually I'm just lazy
    a[0],a[4],a[8],a[12],
    a[1],a[5],a[9],a[13],
    a[2],a[6],a[10],a[14],
    a[3],a[7],a[11],a[15]
  ]);
}

function m4_invC(m){
  let inv=new Float32Array(16);

  inv[0] = m[5]  * m[10] * m[15] - 
            m[5]  * m[11] * m[14] - 
            m[9]  * m[6]  * m[15] + 
            m[9]  * m[7]  * m[14] +
            m[13] * m[6]  * m[11] - 
            m[13] * m[7]  * m[10];

  inv[4] = -m[4]  * m[10] * m[15] + 
            m[4]  * m[11] * m[14] + 
            m[8]  * m[6]  * m[15] - 
            m[8]  * m[7]  * m[14] - 
            m[12] * m[6]  * m[11] + 
            m[12] * m[7]  * m[10];

  inv[8] = m[4]  * m[9] * m[15] - 
            m[4]  * m[11] * m[13] - 
            m[8]  * m[5] * m[15] + 
            m[8]  * m[7] * m[13] + 
            m[12] * m[5] * m[11] - 
            m[12] * m[7] * m[9];

  inv[12] = -m[4]  * m[9] * m[14] + 
              m[4]  * m[10] * m[13] +
              m[8]  * m[5] * m[14] - 
              m[8]  * m[6] * m[13] - 
              m[12] * m[5] * m[10] + 
              m[12] * m[6] * m[9];

  inv[1] = -m[1]  * m[10] * m[15] + 
            m[1]  * m[11] * m[14] + 
            m[9]  * m[2] * m[15] - 
            m[9]  * m[3] * m[14] - 
            m[13] * m[2] * m[11] + 
            m[13] * m[3] * m[10];

  inv[5] = m[0]  * m[10] * m[15] - 
            m[0]  * m[11] * m[14] - 
            m[8]  * m[2] * m[15] + 
            m[8]  * m[3] * m[14] + 
            m[12] * m[2] * m[11] - 
            m[12] * m[3] * m[10];

  inv[9] = -m[0]  * m[9] * m[15] + 
            m[0]  * m[11] * m[13] + 
            m[8]  * m[1] * m[15] - 
            m[8]  * m[3] * m[13] - 
            m[12] * m[1] * m[11] + 
            m[12] * m[3] * m[9];

  inv[13] = m[0]  * m[9] * m[14] - 
            m[0]  * m[10] * m[13] - 
            m[8]  * m[1] * m[14] + 
            m[8]  * m[2] * m[13] + 
            m[12] * m[1] * m[10] - 
            m[12] * m[2] * m[9];

  inv[2] = m[1]  * m[6] * m[15] - 
            m[1]  * m[7] * m[14] - 
            m[5]  * m[2] * m[15] + 
            m[5]  * m[3] * m[14] + 
            m[13] * m[2] * m[7] - 
            m[13] * m[3] * m[6];

  inv[6] = -m[0]  * m[6] * m[15] + 
            m[0]  * m[7] * m[14] + 
            m[4]  * m[2] * m[15] - 
            m[4]  * m[3] * m[14] - 
            m[12] * m[2] * m[7] + 
            m[12] * m[3] * m[6];

  inv[10] = m[0]  * m[5] * m[15] - 
            m[0]  * m[7] * m[13] - 
            m[4]  * m[1] * m[15] + 
            m[4]  * m[3] * m[13] + 
            m[12] * m[1] * m[7] - 
            m[12] * m[3] * m[5];

  inv[14] = -m[0]  * m[5] * m[14] + 
              m[0]  * m[6] * m[13] + 
              m[4]  * m[1] * m[14] - 
              m[4]  * m[2] * m[13] - 
              m[12] * m[1] * m[6] + 
              m[12] * m[2] * m[5];

  inv[3] = -m[1] * m[6] * m[11] + 
            m[1] * m[7] * m[10] + 
            m[5] * m[2] * m[11] - 
            m[5] * m[3] * m[10] - 
            m[9] * m[2] * m[7] + 
            m[9] * m[3] * m[6];

  inv[7] = m[0] * m[6] * m[11] - 
            m[0] * m[7] * m[10] - 
            m[4] * m[2] * m[11] + 
            m[4] * m[3] * m[10] + 
            m[8] * m[2] * m[7] - 
            m[8] * m[3] * m[6];

  inv[11] = -m[0] * m[5] * m[11] + 
              m[0] * m[7] * m[9] + 
              m[4] * m[1] * m[11] - 
              m[4] * m[3] * m[9] - 
              m[8] * m[1] * m[7] + 
              m[8] * m[3] * m[5];

  inv[15] = m[0] * m[5] * m[10] - 
            m[0] * m[6] * m[9] - 
            m[4] * m[1] * m[10] + 
            m[4] * m[2] * m[9] + 
            m[8] * m[1] * m[6] - 
            m[8] * m[2] * m[5];

  det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];

  if (det == 0)
    return false;

  return v_lop(1/det, inv);
}
function m4_invR(m){
  return m4_t(m4_invC(m4_t(m)));
}

function m4_randrot(){ 
  let v1=v_norm(n_gauss(3));
  let v2=n_gauss(3);
  v2=v_norm(v_lop(1, v2, -1, v_proj(v1, v2)));
  let v3=v_norm(new Float32Array([
    v1[1]*v2[2]-v1[2]*v2[1],
    v1[2]*v2[0]-v1[0]*v2[2],
    v1[0]*v2[1]-v1[1]*v2[0]
  ]));
  return new Float32Array([...v1,0,...v2,0,...v3,0,0,0,0,1]); //horay for linalg
}

function m4_print(a){
  for(let i=0; i<4; i++){
    console.log(a[0+4*i],a[1+4*i],a[2+4*i],a[3+4*i]);
  }
}

function m4_transf(x,y,z){
  return new Float32Array([
    1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1
  ]);
}

function m4_scale(x,y,z){
  return new Float32Array([
    x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1
  ]);
}

function b_cc(){
  let c=new Float32Array(Array.from(arguments).map((x)=>x.length??1).reduce((x,y)=>x+y));
  let ind=0;
  for(let i=0; i<arguments.length; i++){
    if(typeof(arguments[i]) == 'object')
      for(let j=0; j<arguments[i].length; j++)
        c[ind++]=arguments[i][j];
    else c[ind++] = arguments[i];
  }
    
  return c;
}

function m4_tprot(theta, phi){
  return m4_mul(new Float32Array([
    1,0,0,0,
    0,Math.cos(phi),-Math.sin(phi),0,
    0,Math.sin(phi),Math.cos(phi),0,
    0,0,0,1,
  ]), new Float32Array([
    Math.cos(theta),0,-Math.sin(theta),0,
    0,1,0,0,
    Math.sin(theta),0,Math.cos(theta),0,
    0,0,0,1,
  ]));
}

let canvas=document.querySelector("canvas");
function m4_pers({
  loc=[0,0,0],
  vdir=[0,0],
  fov=1,
  ar=canvas.height/canvas.width,
  np=1,
  t=false,
}={}){
  const perM = new Float32Array([
    ar*fov,0,0,0,
    0,fov,0,0,
    0,0,0,np,
    0,0,1,0
  ]);
  const transM = m4_transf(-loc[0], -loc[1], -loc[2]);
  const rotM = m4_tprot(vdir[0], vdir[1]);
  return (t? m4_t:(x)=>x)(m4_mul(perM,m4_mul(rotM, transM)));
}
function m4_invpersl({
  vdir=[0,0],
  fov=1,
  ar=canvas.height/canvas.width,
  np=1,
  t=false,
}={}){
  const perM = new Float32Array([
    1/(ar*fov),0,0,0,
    0,1/fov,0,0,
    0,0,0,1/np,
    0,0,1,0
  ]);
  const rotM = m4_t(m4_tprot(vdir[0], vdir[1]));
  return (t? m4_t:(x)=>x)(m4_mul(rotM, perM));
}

let _cam={
  loc:[0,0,0],
  vdir:[0,0],
  lu:Date.now(),
  t:true,
}
let _keys={
  w:false, a:false, s:false, d:false, ' ':false, shift: false,
  arrowdown:false, arrowleft:false, arrowright: false, arrowup:false, 
}

document.addEventListener('keydown',(ev)=>{
  _keys[ev.key.toLowerCase()]=true;
});

document.addEventListener('keyup',(ev)=>{
  _keys[ev.key.toLowerCase()]=false;
});

function c_upd(){
  let dt=Math.min(100, Date.now()-_cam.lu);
  _cam.lu=Date.now();
  let ms=5;
  let as=1.5;

  if(_keys['arrowleft']||_keys['arrowright']){
    dir=_keys['arrowleft']*1-_keys['arrowright']*1;
    _cam.vdir[0]+=-dir*dt*0.005*as;
  }
  if(_keys['arrowup']||_keys['arrowdown']){
    dir=_keys['arrowup']*1-_keys['arrowdown']*1;
    _cam.vdir[1]+=dir*dt*0.005*as;
  }
  
  if(_keys['w']||_keys['s']){
    dir=_keys['w']*1-_keys['s']*1;
    _cam.loc[2]+=dir*Math.cos(_cam.vdir[0])*dt*0.005*ms;
    _cam.loc[0]+=dir*Math.sin(_cam.vdir[0])*dt*0.005*ms;
  }
  if(_keys['a']||_keys['d']){
    dir=_keys['a']*1-_keys['d']*1;
    _cam.loc[0]+=-dir*Math.cos(_cam.vdir[0])*dt*0.005*ms;
    _cam.loc[2]+=dir*Math.sin(_cam.vdir[0])*dt*0.005*ms;
  }
  if(_keys[' ']||_keys['shift']){
    dir=_keys[' ']*1-_keys['shift']*1;
    _cam.loc[1]+=dir*dt*0.005*ms;
  }
}