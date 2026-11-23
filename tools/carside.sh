#!/bin/zsh
# 用和特斯拉側面圖差不多的鏡頭（約 13.8 m 遠、眼睛高 0.74 m）拍汽車的左側面，白底、不要地面，給疊圖用
F="$PWD/dist/peelback.html#car"
node tools/shot.mjs "$F" "$1" 1600 900 3500 'js:{const c=__BUS.camera;document.querySelectorAll(".top,.bar,.stack,.hint,.card").forEach(e=>e.style.display="none");const sc=__BUS.bus.root.parent;sc.children.forEach(o=>{if(o!==__BUS.bus.root&&o.isMesh)o.visible=false});document.documentElement.style.setProperty("--bg","#ffffff");document.documentElement.dataset.theme="light";__BUS.controls.enabled=false;c.clearViewOffset();c.fov=12;c.aspect=1600/900;c.up.set(0,1,0);c.position.set(0,1.48,-27.6);c.lookAt(0,1.48,0);c.updateProjectionMatrix();__BUS.controls.target.set(0,1.48,0);__BUS.controls.update=()=>{};}' wait:900
