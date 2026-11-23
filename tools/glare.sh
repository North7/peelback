#!/bin/zsh
# 反光檢查：深色模式、鏡頭貼近從斜下方看（太陽在車子後上方，最容易出現刺眼高光）
# glare.sh 輸出前綴
export PATH=~/.local/share/nodejs/current/bin:$PATH
F="$PWD/dist/peelback.html"
for v in bus plane car; do
  node tools/shot.mjs "$F#$v" "$1_$v.png" 1600 900 5000 "js:document.documentElement.dataset.theme='dark'" wait:800 "js:{document.querySelectorAll('.top,.bar,.stack,.hint,.card').forEach(e=>e.style.display='none');const c=__BUS.camera,t=__BUS.controls.target;__BUS.controls.enabled=false;__BUS.controls.update=()=>{};const b=new c.position.constructor();const box=new (c.position.constructor)();const r=__BUS.bus.root;const B=new (Object.getPrototypeOf(r.position).constructor)();const bb={min:{},max:{}};r.updateMatrixWorld(true);c.clearViewOffset();c.fov=40;c.up.set(0,1,0);c.position.set(t.x+9,t.y-0.3,t.z+7);c.lookAt(t.x,t.y+0.8,t.z);c.updateProjectionMatrix();}" wait:900 2>&1 | grep -v "ERR_FAILED\|^ERRORS"
done
