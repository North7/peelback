#!/bin/zsh
# 汽車從指定方向拍（白底、不要介面）：carview.sh 輸出檔 x z [y=2.1] [fov=13]
F="$PWD/dist/peelback.html#car"
X=$2; Z=$3; Y=${4:-2.1}; FOV=${5:-13}
node tools/shot.mjs "$F" "$1" 1600 900 3500 "js:{const c=__BUS.camera;document.querySelectorAll('.top,.bar,.stack,.hint,.card').forEach(e=>e.style.display='none');document.documentElement.style.setProperty('--bg','#ffffff');document.documentElement.dataset.theme='light';__BUS.controls.enabled=false;c.clearViewOffset();c.fov=$FOV;c.aspect=1600/900;c.up.set(0,1,0);c.position.set($X,$Y,$Z);c.lookAt(0,1.3,0);c.updateProjectionMatrix();__BUS.controls.update=()=>{};}" wait:900
