import { Session, inline } from "../src/q/index";
const s = new Session();
for (const src of ["2*3+4", "sum til 10", "x:3; x*x", "{x*2} each 1 2 3"]) {
  const { steps } = s.trace(src);
  console.log(src);
  for (const st of steps) console.log("   ", src.slice(st.s, st.e).padEnd(18), "→", inline(st.value, 7));
}
