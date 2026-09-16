'use strict';
const worlds={subzero:require('./public/maps/subzero-world.json'),village:require('./public/maps/village-world.json')};
const catalog=Object.values(worlds).map(w=>({id:w.MAP.id,name:w.MAP.name,description:w.MAP.id==='village'?'Medieval streets · market square · upper balconies':'Snowbound arena · tight alleys · original map',overview:w.MAP.overview||null}));
module.exports={worlds,catalog};
