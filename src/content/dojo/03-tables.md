---
title: Tables
chapter: Dojo
blurb: select, update, by — kdb+ home turf.
---

```q challenge
%% title City revenue
%% level warmup
%% goal From sales, build a table of city and totalRevenue for cities with at least 200 in total, biggest first.
%% show answer
sales:([] city:`London`London`Paris`Paris`Berlin`Berlin; quarter:`Q1`Q2`Q1`Q2`Q1`Q2; revenue:120 140 90 110 80 70)
answer:sales
%% check answer~([] city:`London`Paris; totalRevenue:260 200) | answer should have London 260 and Paris 200, as a plain (unkeyed) table.
%% hint select totalRevenue:sum revenue by city from sales groups and totals.
%% hint 0! un-keys a table; `totalRevenue xdesc sorts it.
%% solution
sales:([] city:`London`London`Paris`Paris`Berlin`Berlin; quarter:`Q1`Q2`Q1`Q2`Q1`Q2; revenue:120 140 90 110 80 70)
t:0!select totalRevenue:sum revenue by city from sales
answer:`totalRevenue xdesc select from t where totalRevenue>=200
```

```q challenge
%% title Hot days
%% level warmup
%% goal Build a table of day and tempC for days hotter than 24 °C, hottest first.
%% show answer
weather:([] day:`Mon`Tue`Wed`Thu`Fri`Sat`Sun; tempC:18 22 20 27 25 31 16)
answer:weather
%% check answer~([] day:`Sat`Thu`Fri; tempC:31 27 25) | answer should be Sat 31, Thu 27, Fri 25.
%% hint select from weather where tempC>24, then sort with `tempC xdesc.
%% solution
weather:([] day:`Mon`Tue`Wed`Thu`Fri`Sat`Sun; tempC:18 22 20 27 25 31 16)
answer:`tempC xdesc select from weather where tempC>24
```

```q challenge
%% title Monthly lift
%% level core
%% goal For months where visits went up, build month and lift (the increase). Keep the two biggest lifts, biggest first.
%% show answer
traffic:([] month:`Jan`Feb`Mar`Apr`May`Jun; visits:108 124 119 147 141 162)
answer:traffic
%% check answer~([] month:`Apr`Jun; lift:28 21) | answer should be Apr 28 and Jun 21.
%% hint deltas visits gives each month's change. The first month has nothing before it — drop it.
%% solution
traffic:([] month:`Jan`Feb`Mar`Apr`May`Jun; visits:108 124 119 147 141 162)
t:1_update lift:deltas visits from traffic
answer:2#`lift xdesc select month, lift from t where lift>0
```

```q challenge
%% title Top salary per department
%% level core
%% goal Build dept and maxSalary — the highest salary in each department — biggest first.
%% show answer
staff:([] name:`Alice`Bob`Carlos`Diana`Eve; dept:`Eng`Mktg`Eng`Ops`Mktg; salary:95000 67000 112000 78000 71000)
answer:staff
%% check answer~([] dept:`Eng`Ops`Mktg; maxSalary:112000 78000 71000) | answer should be Eng 112000, Ops 78000, Mktg 71000.
%% hint select maxSalary:max salary by dept from staff
%% solution
staff:([] name:`Alice`Bob`Carlos`Diana`Eve; dept:`Eng`Mktg`Eng`Ops`Mktg; salary:95000 67000 112000 78000 71000)
answer:`maxSalary xdesc 0!select maxSalary:max salary by dept from staff
```

```q challenge
%% title Goal difference
%% level core
%% goal Build team and goalDiff — total goals scored minus conceded — best first.
%% show answer
matches:([] team:`Arsenal`Arsenal`Chelsea`Chelsea`Spurs`Spurs; scored:2 3 1 4 0 2; conceded:1 0 3 1 2 1)
answer:matches
%% check answer~([] team:`Arsenal`Chelsea`Spurs; goalDiff:4 1 -1) | answer should be Arsenal 4, Chelsea 1, Spurs -1.
%% hint select goalDiff:sum scored-conceded by team from matches
%% solution
matches:([] team:`Arsenal`Arsenal`Chelsea`Chelsea`Spurs`Spurs; scored:2 3 1 4 0 2; conceded:1 0 3 1 2 1)
answer:`goalDiff xdesc 0!select goalDiff:sum scored-conceded by team from matches
```
