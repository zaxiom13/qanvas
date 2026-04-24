/ Qanvas5 runtime bridge

.qv.cmds:enlist[::]
.qv.state:(::)
.qv.config:(::)

Color.INK:855327
Color.NIGHT:329228
Color.MIDNIGHT:724250
Color.DEEP:528424
Color.BLUE:5992424
Color.SKY:8169215
Color.GOLD:12883310
Color.CORAL:14711378
Color.RED:13723982
Color.PURPLE:9202633
Color.GREEN:5152658
Color.CREAM:16051416
Color.YELLOW:16769696
Color.SOFT_YELLOW:16769720
Color.LAVENDER:14989311
Color.ORBIT:2500938

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
