# Spec 1: Bee colony game, design and playable prototype

GitHub issue #1, "Design the game and make a prototype". Status: draft, waiting for the experience designer and the red team.

## John's words

> I want to design this game and then make a working, in-browser, playable prototype. The game is about bees, and bees have to build a colony, make a hive, tend to the hive, build it, clean it, and then they've got to get pollen. They've got to make honey, and they get points for things like how big their civilization is, how much honey they can generate, how much honeycomb, and how big their hive gets. They also have to figure out how to defend themselves from onslaughts of murder hornets.
>
> You've got to do the gameplay design, and I'm not sure what the player is. Maybe the player is the queen bee, I guess, and then the queen bee has to be able to successfully create bees that do different things, like defenders, scouts, hive builders, and honeymakers, all that sort of thing. You need to design it, and then I want you to make a playable game for it, a first prototype.

## What will be built

Two things, in this order:

1. **A game design document**, `docs/game-design.md`, written for John: who the player is, what the player does, the castes, the resources, the hornets, how a game ends and how points are counted, with the starting balance numbers. The prototype follows it; where building shows the design is wrong, the document changes in the same commit as the code.
2. **A playable prototype** in `game/`: one page, `game/index.html`, that runs in a desktop browser opened straight from disk. It needs no install, no server, no network and no account. Plain JavaScript and the browser's canvas; no outside libraries.

### The game in one paragraph
The player is the queen. She lays eggs, and for each egg the player picks what the bee will become. Bees then work on their own: builders make wax and build comb, nurses feed larvae and clean cells, foragers bring back nectar and pollen from flower patches that scouts find, honeymakers turn nectar into honey, and defenders guard the entrance. Waves of murder hornets attack, larger each time. The game runs through one season; the score is how big the colony, the honey store, the comb and the hive have grown. The game ends early if the hornets kill the queen.

### Design (the design document expands this; numbers are starting values and live in data, not code)
- **Player.** The queen, as the colony's mind. She stays in the hive. The player's choices: lay an egg and pick its caste, set how many eggs of each caste to lay in a row (a standing order, so the player does not have to click once per egg), and move bees between castes. Bees do their jobs without being steered one by one.
- **Castes.** Six, covering every job John named:

| Caste | Job | John's words it covers |
|---|---|---|
| Builder | Turns honey into wax, builds comb cells, adds new chambers to the hive | "make a hive", "build it", "hive builders" |
| Nurse | Feeds larvae with pollen and honey, cleans dirty cells | "tend to the hive", "clean it" |
| Forager | Flies to known flower patches, brings back nectar and pollen | "get pollen" |
| Honeymaker | Turns stored nectar into honey in comb cells | "make honey", "honeymakers" |
| Scout | Finds new flower patches; spots hornet waves before they arrive | "scouts" |
| Defender | Guards the entrance and fights hornets | "defend themselves", "defenders" |

- **Resources.** Nectar, pollen, honey, wax, comb cells. An egg costs honey and pollen and needs a clean empty cell. Comb cells hold honey, nectar, pollen or brood, so comb limits both stores and population. Used cells get dirty and cannot be reused until a nurse cleans them.
- **Life cycle.** Egg, larva (needs feeding), adult. Adults live a set time, so the queen has to keep laying to keep the colony alive.
- **The meadow.** The hive sits in a meadow of flower patches laid out from the game's seed. Patches run dry and grow back. Foragers only go to patches a scout has found.
- **Murder hornets.** Waves come at set times, each larger than the last. A scout that sees a wave gives the player warning. Hornets fight defenders at the entrance; hornets that get in kill bees, eat brood and take honey. If they reach the queen, the game ends.
- **Time.** Real time, with pause and two speeds. One season is a fixed number of in-game days, sized so that a game takes about 15 to 25 minutes at normal speed.
- **Points.** John's four measures, each shown live on screen and added up at the end: colony size (living bees), honey made over the game, honeycomb (comb cells built) and hive size (chambers). The end screen shows each part and the total, and how the game ended.
- **Seed.** Every game has a seed shown on screen. The same seed and the same player choices give the same game. A new game picks a new seed unless the player types one.
- **How to play.** One help screen inside the game, reachable at any time, that a first-time player can read before starting.

### Built so it can be checked
- The simulation (the rules) is separate from drawing and input, and runs without a browser: `node game/sim/run.js --seed <n> --strategy <name>` plays a whole season with a scripted strategy and prints the score parts and how the game ended. Strategies are data: a list of standing orders.
- All balance numbers live in one data file, `game/data/balance.js`; the rules read them from there.
- Tests run with `node --test game/tests/`.

## Acceptance
Each check has a yes or no answer.

1. `docs/game-design.md` exists and covers the player, the six castes, the resources, the life cycle, the meadow, the hornets, the end of a game and the points.
2. Opening `game/index.html` from disk in current desktop Chrome, with the network off, shows the help screen and then a game that starts on one click, with no errors in the browser console.
3. The player plays the queen: she can lay an egg of each of the six castes, set a standing order, and move a bee from one caste to another.
4. During a game, the player can see each caste doing its job: comb cells and chambers being added, larvae fed, dirty cells cleaned, nectar and pollen carried in, nectar turned into honey, a new patch found by a scout, and defenders fighting hornets.
5. At least three hornet waves arrive in a full season, each larger than the one before, and a scout gives warning before at least one of them.
6. The four score parts and the total are on screen during play and on the end screen.
7. A game ends in one of two ways, the season ending or the queen dying, and the end screen says which.
8. `node game/sim/run.js` gives the same output twice for the same seed and strategy.
9. Over 20 seeds that nobody used while tuning, a stored "no defenders" strategy loses the queen before the season ends in at least 15, and a stored "balanced" strategy survives the season in at least 15. (The game can be lost and can be won.)
10. Over the same 20 seeds, the "balanced" strategy scores higher than a stored "lay nothing after the start" strategy in all 20. (The player's choices matter.)
11. A full game at normal speed lasts between 15 and 25 minutes when the queen survives.
12. `node --test game/tests/` passes.

## Checks every feature passes (hive/PROJECT.md)
1. **Nothing about one particular case in the code.** No seed, map layout or tuned number is written into the rules or drawing code; seeds come from the player or a random draw, and balance numbers come from `game/data/balance.js`. The 20 test seeds in check 9 live in a data file under `game/tests/`. Check: a reviewer searches the files under `game/sim/` and the drawing code for numbers other than 0 and 1, and every one found has a comment saying why it is not balance.
2. **It works on a case it was not built on.** Before the epic closes, a product reviewer who did none of the building plays one full game in the browser on a seed drawn after the last commit, and records the seed, the end screen and what went wrong. The 20 seeds in checks 9 and 10 are drawn after tuning stops and are not used to tune.
3. **No worse than today.** There is no game today, so there is nothing to compare at first. The parts that make a judgment are the balance and the hornet behaviour. From the first release on, any later change to either runs old and new on the same 20 stored seeds and strategies, and an agent that did none of the work reads the two sets of results without knowing which is which.

## How it serves the product test
The product test (hive/strategy/PRODUCT-TEST.md) asks whether a person who plays for a week on their own would keep playing, and what made them want to stop. This prototype makes that test possible: it runs with nothing to install, every game is different through its seed, a game is short enough to play several times in a sitting, and the end screen shows the score parts and the seed so a player can say what went wrong and on which game. The design document names the three things most likely to make a player stop (too little to do between waves, losing to hornets with no warning, and clicking once per egg) and what the design does about each.

## DECIDED
Two choices are John's and are in Decide below, not here: who the player is (question 1) and how long a game lasts (question 2). The spec is written on the recommended answers.

- DECIDED: Six castes: builder, nurse, forager, honeymaker, scout, defender. Nurses cover tending and cleaning; foragers cover getting pollen. (goal: every job John named has a caste)
- DECIDED: The score has exactly John's four parts: colony size, honey made, honeycomb, hive size. Hornets fought are not scored. (goal: John's list of what earns points)
- DECIDED: The design comes first, as `docs/game-design.md`, and the prototype follows it. (goal: "You need to design it, and then I want you to make a playable game")
- DECIDED: The prototype is one page that runs from disk in a desktop browser, with no install, server, network or outside library. (goal: "working, in-browser, playable prototype"; no spend)
- DECIDED: Real time with pause and two speeds, one season per game, about 15 to 25 minutes. (goal: playable more than once in a sitting, for the product test)
- DECIDED: Hornets come in waves that grow, and can end the game by killing the queen. (goal: "onslaughts of murder hornets")
- DECIDED: Shapes and colour only; no drawn art, sound or music. (goal: "a first prototype")
- DECIDED: Desktop browser with mouse and keyboard only; phones and touch are not supported. (goal: "a first prototype")
- DECIDED: No saved games, accounts, leaderboard or multiplayer. (goal: "a first prototype"; no spend)

## Decide (questions for John, as in the issue brief)
1. Is the player the queen bee, laying eggs and choosing what each bee becomes? Recommended: yes.
2. Does a game last one season and end with a score, rather than run without end? Recommended: one season of about 15 to 25 minutes, so it can be played several times in a sitting.
3. Should the prototype be put online for people other than you to play? Recommended: no; it stays in the repository and you open it from disk.

## What the user does

**This section changes what will be built in five places.** The game can be made easy, but not exactly as "Design" above describes it. The spec writer and the red team should fold these into "Design" and "Acceptance" or reject them:

1. **The colony mix replaces picking a caste per egg.** The player sets one mix of shares for the six castes, and the queen lays toward it. Four ready-made mixes (Grow, Gather, Defend, Balanced) set all six shares in one click; plus and minus buttons per caste fine-tune them. Picking a caste for a single egg is dropped. "Design" lists it as a player choice; the mix covers it.
2. **The game starts with a mix already set.** It starts on Grow, whose shares live in `game/data/balance.js`. Grow builds the colony well but lays few defenders, so a player who changes nothing grows a large colony and then loses the queen to a later wave.
3. **A scout's warning pauses the game and offers one answer.** The warning gives the wave's size and the defender count and offers "Defend" (switch to the Defend mix and move bees to defence) or "Keep my mix". After the wave is beaten, the mix goes back to what it was before. A notice says so and offers "Keep Defend".
4. **Moving bees between castes is one click, not one bee at a time.** "Match the mix now" moves adult bees to fit the current mix. The game never asks which bee or how many.
5. **The end screen gives a game record.** The record is the seed plus every choice the player made, with the in-game day of each, written as a strategy that `node game/sim/run.js` can replay. The same choices are open to the screen and to an assistant.

Change 2 adds one acceptance check: over the 20 stored seeds, a stored "change nothing" strategy (Grow throughout, always "Keep my mix") loses the queen in at least 15. Without it, a player who does nothing could win, and the product test's "too little to do between waves" goes unchecked.

### The steps

The player does five things. The table counts the decisions in one full game with three hornet waves. "Before" means "Design" as written above, and "after" means with the five changes.

| What the player does | Decisions before | Decisions after | If the player does nothing |
|---|---|---|---|
| Start a game | 2: type a seed or not, read help or not | 0 | Not possible: a first click on "Start" is needed. The game uses a new seed and the Grow mix. |
| Decide what bees to make | 6 to set the standing order, then 1 per egg picked by hand | 0 needed; 1 per mix change chosen | The queen keeps laying to the Grow mix. |
| Answer a hornet warning | 6 to rewrite the standing order, plus 3 per bee move (from, to, how many), so 9 per wave, or 27 in a game | 1 per wave, or 3 in a game | The game stays paused on the warning until the player answers. |
| Go back after a wave | 6 per wave, or 18 in a game | 0; the game goes back by itself, and "Keep Defend" undoes that | The mix goes back to what it was before the warning. |
| Finish and play again | 1: new seed or same seed | 1 | The end screen stays up. |
| **Total, one game** | **about 54, plus 1 per egg picked by hand** | **4 needed: 3 warnings and 1 "play again"** | The colony grows and then loses the queen to a later wave. |

The steps after, in the player's own words:

1. **Start.** "I open `game/index.html`. The title screen shows the seed, three lines on how to play and a How to play button. I click Start."
2. **Watch and steer.** "My bees get to work. If I want more honey, I click Gather. If I want to tune it, I press plus on Honeymaker." Space pauses the game, and 1 and 2 set the speed. A one-line notice explains anything that stops the queen from laying, together with the fix: "The queen has stopped laying: no clean cells. More nurses would clean them. [Add nurses]". Add nurses adds one nurse share and can be undone with minus.
3. **Answer a warning.** "A scout spots hornets and the game pauses." The player sees:
   > Hornets in 2 days: about 14. You have 4 defenders.
   > [Defend] lays defenders first and moves 6 bees to defence now.
   > [Keep my mix]
   "I click Defend."
4. **After the wave.** The game shows: "Wave beaten. 3 defenders lost. Your mix is back to Gather. [Keep Defend]". "I carry on."
5. **End.** The end screen shows how the game ended (the season ended, or the hornets killed the queen), the four score parts, the total, the seed and "Copy game record". "I click Play again, or Replay this seed to try it differently."

What the player is asked to accept, with what they would have seen before:
- **At the warning.** Before: nothing would stop the game, and a player at fast speed could miss the scout's warning. After: the paused prompt above, with the numbers the player needs to judge it.
- **On "Match the mix now".** Before: a from, to and how-many choice for each move. After: one line, "Move 4 foragers and 2 builders to defence. [Move] [Cancel]".
- **After the wave.** Before: the player rewrote the standing order. After: the "Wave beaten" notice above.

### By assistant

The game runs from disk with no server, so an assistant cannot play a live game in the player's browser. It works through the simulation and the game record, and those offer the same choices as the screen: mixes, fine-tuning, Match the mix now, an answer to each warning, and the seed.

> **Player:** I lost the queen on day 41. Here's my game record. What went wrong?
> **Assistant:** (replays the record with the day-by-day log) You answered all three warnings with "Keep my mix". The third wave had 22 hornets against your 5 defenders.
> **Player:** Would Defend on the third one have saved me?
> **Assistant:** (replays the record with that one answer changed) Yes. The queen survives and your total goes from 0 to 1,840 [example figures]. Want the seed to try it yourself?
> **Player:** Yes.
> **Assistant:** Open `game/index.html?seed=48213`.

The assistant needs these tools. They are commands, and except for the seed in the address, each is already part of "Built so it can be checked" or one of the changes above:

| Tool | Takes | Returns |
|---|---|---|
| Run a season: `node game/sim/run.js` | a seed, and a strategy name or a game record file | how the game ended, the four score parts and the total |
| The same command with `--log` | the same inputs | for each day: warnings, the answer given, the wave's outcome, mix changes and notices that laying stopped |
| The same command with `--list-strategies` | nothing | the name of each stored strategy, with one line on what it does |
| Open a seed: `game/index.html?seed=<n>` | a seed | the browser game started on that seed (new: the page reads the seed from its address) |
| Copy game record (on the end screen) | a click by the player | the seed and every choice, with its day, as strategy text the first command reads |

### Tested on a different field

The same steps were tried on a made-up hospital ward. A charge nurse staffs a ward from six roles, and the emergency department warns of patient surges. Before the change, the nurse assigns each new hire a role and rewrites the staffing after every surge. After it, the ward runs on a staffing mix. A surge warning offers "Surge staffing" or "Keep", and staffing goes back by itself after the surge. The steps held, with one finding. Staffing must go back when the surge is over, not after a set time, or a long surge leaves the ward short. In the game, this means the mix goes back when the last hornet of the wave is dead or gone, not after a set number of days.
