import fs from "node:fs";import path from "node:path";import {OUT} from "./lib.mjs";
const mods=process.argv.slice(2);
for(const m of mods.length?mods:["a","b","c","d","e"]){const mod=await import("./page-"+m+".mjs");const files=mod.build();for(const [n,h] of Object.entries(files)){fs.writeFileSync(path.join(OUT,n),h);console.log("wrote",n,(h.length/1024).toFixed(0)+"KB");}}
