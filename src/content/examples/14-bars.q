/ @title Letter bars
/ @level arrays
/ @blurb qSQL feeds a chart: count the letters in a sentence.

s:"the quick brown fox jumps over the lazy dog"
t:select n:count i by c from ([] c:s except " ")
k:count t
bw:560%k
hts:(500%max value[t]`n)*value[t]`n

background 250 247 240
ink `indigo
rect[(20+bw*til k;570-hts);(bw-4;hts)]
ink 40; font 14; align `center
text[(20+bw*0.5+til k;592);string key[t]`c]
