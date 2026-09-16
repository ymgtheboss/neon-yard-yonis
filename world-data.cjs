'use strict';
// Keep the original arena available for regression checks and rollback.
module.exports=process.env.WORLD_MAP==='mill'
 ? {...require('./mill-world.cjs'),MAP:null}
 : require('./map-catalog.cjs').worlds[process.env.WORLD_MAP==='village'?'village':'subzero'];
