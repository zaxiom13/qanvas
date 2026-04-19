/ Qanvas5 runtime bridge

.qv.cmds:enlist[::]
.qv.state:(::)
.qv.config:(::)

.qv.emit:{[kind;payload]
  -1 raze ("__QANVAS_";kind;"__";payload);
}

.qv.emitjson:{[kind;v]
  .qv.emit[kind;.j.j v];
}

.qv.errmsg:{[err]
  $[10h=type err; err; string err];
}

.qv.append:{[cmd]
  .qv.cmds,:enlist cmd;
  :cmd;
}

background:{[fill]
  .qv.append `kind`fill!(`background;fill);
}

circle:{[data]
  .qv.append `kind`data!(`circle;data);
}

rect:{[data]
  .qv.append `kind`data!(`rect;data);
}

pixel:{[data]
  .qv.append `kind`data!(`pixel;data);
}

line:{[data]
  .qv.append `kind`data!(`line;data);
}

text:{[data]
  .qv.append `kind`data!(`text;data);
}

image:{[data]
  .qv.append `kind`data!(`image;data);
}

generic:{[cmds]
  .qv.cmds,:$[0h=type cmds;cmds;enlist cmds];
  :cmds;
}

push:{[]
  .qv.append enlist[`kind]!enlist `push;
}

pop:{[]
  .qv.append enlist[`kind]!enlist `pop;
}

translate:{[xy]
  .qv.append `kind`x`y!(`translate;first xy;last xy);
}

scale:{[xy]
  if[1=count xy;xy:xy,xy];
  .qv.append `kind`x`y!(`scale;first xy;last xy);
}

cursor:{[name]
  .qv.append `kind`cursor!(`cursor;name);
}

.qv.init:{
  .qv.cmds:enlist[::];
  result:setup[];
  .qv.state:result;
  .qv.config:result;
  .qv.emitjson["INIT";result];
  :result;
}

.qv.frame:{[frameJson;inputJson;canvasJson]
  .qv.cmds:enlist[::];
  frameData:.j.k frameJson;
  inputData:.j.k inputJson;
  canvasData:.j.k canvasJson;
  state1:draw[.qv.state;frameData;inputData;canvasData];
  .qv.state:state1;
  .qv.emitjson["FRAME";1_ .qv.cmds];
  :(::);
}
