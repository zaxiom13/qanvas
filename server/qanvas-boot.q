/ qanvas-boot.q -- q-side protocol server for Qanvas.
/ Usage: q server/qanvas-boot.q -p 5042
/ Then point Qanvas client at ws://127.0.0.1:5042 (default local-q URL).

\d .qv

cmds:enlist (::)
state:()
config:()
files:()

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

append:{[cmd] cmds,:enlist cmd; :cmd}

background:{[fill]    append `kind`fill!(`background;fill)}
circle:    {[data]    append `kind`data!(`circle;data)}
rect:      {[data]    append `kind`data!(`rect;data)}
pixel:     {[data]    append `kind`data!(`pixel;data)}
line:      {[data]    append `kind`data!(`line;data)}
text:      {[data]    append `kind`data!(`text;data)}
image:     {[data]    append `kind`data!(`image;data)}
generic:   {[x]       cmds,:$[0h=type x;x;enlist x]; :x}

push:      {[]        append enlist[`kind]!enlist `push}
pop:       {[]        append enlist[`kind]!enlist `pop}
translate: {[xy]      append `kind`x`y!(`translate;first xy;last xy)}
scale:     {[xy]      if[1=count xy;xy:xy,xy]; append `kind`x`y!(`scale;first xy;last xy)}
cursor:    {[name]    append `kind`cursor!(`cursor;name)}

reply:{[h;id;ok;val]
  r:$[ok; `id`ok`value!(id;1b;val); `id`ok`error!(id;0b;val)];
  neg[h] .j.j r;
 }

emit:{[h;kind;v] neg[h] .j.j `evt`value!(kind;v)}

\d .

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

/ NOTE: init/frame live at ROOT namespace so unqualified `setup` and `draw`
/ references resolve to the user's functions, which are also defined at root.

qanvas.loadFiles:{[fs]
  .qv.files:fs;
  / Write each file to a temp path and load via system "l" so multi-statement
  / bodies (setup AND draw) are both parsed. `value` only takes one expression.
  dir:getenv[`TMPDIR];
  dir:$[0=count dir; "/tmp"; dir];
  {[f;d]
    path:d,"/qanvas_",string[.z.i],"_",f`name;
    path:$[10h=type path; path; -1 "path type err: ",-3!path; path];
    (`$":",path) 0: enlist f`content;
    system "l ",path;
    hdel `$":",path;
   }[;dir] each fs;
  / Alias qv drawing primitives into root so user code can call them unqualified.
  `background`circle`rect`pixel`line`text`image`generic`push`pop`translate`scale`cursor set'
    (.qv.background; .qv.circle; .qv.rect; .qv.pixel; .qv.line; .qv.text; .qv.image;
     .qv.generic; .qv.push; .qv.pop; .qv.translate; .qv.scale; .qv.cursor);
 }

qanvas.init:{
  .qv.cmds:enlist (::);
  r:setup[];
  .qv.state:r;
  .qv.config:$[99h=type r;r;()!()];
  :r
 }

qanvas.frame:{[f;i;c]
  .qv.cmds:enlist (::);
  state1:draw[.qv.state;f;i;c];
  .qv.state:state1;
  :1_.qv.cmds
 }

qanvas.handleStart:{[h;id;pl]
  qanvas.loadFiles[pl`files];
  qanvas.init[];
  .qv.reply[h;id;1b;`config`backend`fallbackReason!(.qv.config;"real-q";0N)];
 }

qanvas.handleFrame:{[h;id;pl]
  cmds:qanvas.frame[pl`frameInfo;pl`input;pl`canvas];
  .qv.reply[h;id;1b;cmds];
 }

qanvas.handleQuery:{[h;id;pl]
  r:value pl`expression;
  .qv.reply[h;id;1b;`ok`value!(1b;r)];
 }

qanvas.handleStartCommands:{[h;id;pl] .qv.reply[h;id;1b;1_.qv.cmds]}

qanvas.handleStop:{[h;id;pl]
  .qv.state:();
  .qv.cmds:enlist (::);
  .qv.reply[h;id;1b;(::)];
 }

qanvas.dispatch:{[h;msg]
  id:msg`id;
  op:msg`op;
  pl:msg`payload;
  handlers:`start`frame`query`start_commands`stop!
    (qanvas.handleStart; qanvas.handleFrame; qanvas.handleQuery; qanvas.handleStartCommands; qanvas.handleStop);
  opKey:`$ssr[op;"-";"_"];
  fn:handlers opKey;
  $[null fn;
     .qv.reply[h;id;0b;"unknown op: ",op];
     .[fn; (h;id;pl); {[a;e] .qv.reply[a 0;a 1;0b;e]}[(h;id)]]
   ]
 }

.z.wo:{[h] 
  @[{[hh] neg[hh] .j.j `evt`info!("hello"; `kind`label`engine!("local-q";"Local q (kdb+)";"kdb+"))};
    h;
    {[e] -1 "[qanvas] .z.wo error: ",e;}];
 }
.z.wc:{[h] -1 "client disconnected: ",string h;}
.z.ws:{[msg]
  @[qanvas.dispatch[.z.w]; .j.k msg; {[e] -1 "[qanvas] ws handler error: ",e;}];
 }
.z.ph:{[x] "Qanvas q running. Connect via WebSocket."}

-1 "[qanvas] websocket handlers installed. Listening on port ",string system"p";
