# Spec 1: Bee colony game, design and playable prototype

GitHub issue #1, "Design the game and make a prototype". Status: revised once after the red team (bead hive-test-f3o). The experience designer's changes and John's answer on how the queen chooses castes are now part of "Design" and "Acceptance".

## John's words

> I want to design this game and then make a working, in-browser, playable prototype. The game is about bees, and bees have to build a colony, make a hive, tend to the hive, build it, clean it, and then they've got to get pollen. They've got to make honey, and they get points for things like how big their civilization is, how much honey they can generate, how much honeycomb, and how big their hive gets. They also have to figure out how to defend themselves from onslaughts of murder hornets.
>
> You've got to do the gameplay design, and I'm not sure what the player is. Maybe the player is the queen bee, I guess, and then the queen bee has to be able to successfully create bees that do different things, like defenders, scouts, hive builders, and honeymakers, all that sort of thing. You need to design it, and then I want you to make a playable game for it, a first prototype.

John's answer on queen control, on issue #1:

> John's answer on queen control: **both**. The colony mix sets what eggs become by default; the queen can still pick the next egg's caste by hand at any time.

## What will be built

Two things, in this order:

1. **A game design document**, `docs/game-design.md`, written for John: who the player is, what the player does, the castes, the resources, the hornets, how a game ends and how points are counted, with the starting balance numbers. The prototype follows it; where building shows the design is wrong, the document changes in the same commit as the code.
2. **A playable prototype** in `game/`: one page, `game/index.html`, that runs in a desktop browser opened straight from disk. It needs no install, no server, no network and no account. Plain JavaScript and the browser's canvas; no outside libraries.

### The game in one paragraph
The player is the queen. She lays eggs, and a colony mix the player sets decides what each egg becomes; the player can also pick the caste of the next egg by hand at any time. Bees then work on their own: builders make wax and build comb, nurses feed larvae and clean cells, foragers bring back nectar and pollen from flower patches that scouts find, honeymakers turn nectar into honey, and defenders guard the entrance. Waves of murder hornets attack, larger each time. A scout who sees a wave coming pauses the game and the player answers in one click. The game runs through one season; the score is how big the colony, the honey store, the comb and the hive have grown. The game ends early if the hornets kill the queen.

### Design (the design document expands this; numbers are starting values and live in data, not code)
- **Player.** The queen, as the colony's mind. She stays in the hive. The player has five kinds of choice, and every one of them goes into the game record:
  - **Set the colony mix.** The mix is a share for each of the six castes. Four ready-made mixes (Grow, Gather, Defend, Balanced) set all six shares in one click. Plus and minus buttons per caste change one share. The queen lays toward the mix: each egg becomes the caste furthest below its share of the eggs laid since the mix was last set.
  - **Pick the next egg's caste by hand.** At any time the player can choose the caste of the next egg. That one egg becomes the chosen caste, and the queen then goes back to the mix.
  - **Match the mix now.** One click moves adult bees between castes to fit the current mix. The game shows one line naming the moves ("Move 4 foragers and 2 builders to defence. [Move] [Cancel]") and never asks which bee or how many.
  - **Answer a hornet warning** with Defend or Keep my mix (see "Murder hornets").
  - **Keep Defend** after a wave, instead of letting the mix go back.
- **Start.** A new game starts on the Grow mix, whose shares live in `game/data/balance.js`. Grow builds the colony well but lays few defenders, so a player who changes nothing grows a large colony and then loses the queen to a later wave.
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
- **Laying stopped.** When the queen cannot lay, a one-line notice names the cause and offers the fix, for example "The queen has stopped laying: no clean cells. More nurses would clean them. [Add nurses]". The fix button adds one share to the caste it names; minus undoes it.
- **Life cycle.** Egg, larva (needs feeding), adult. Adults live a set time, so the queen has to keep laying to keep the colony alive.
- **The meadow.** The hive sits in a meadow of flower patches laid out from the game's seed. Patches run dry and grow back. Foragers only go to patches a scout has found.
- **Murder hornets.** Waves come at set times, each larger than the last. A scout that sees a wave pauses the game and shows the wave's size, when it arrives and the defender count, with two answers: "Defend" (switch to the Defend mix and match the mix now) or "Keep my mix". The game stays paused until the player answers. Hornets fight defenders at the entrance; hornets that get in kill bees, eat brood and take honey. If they reach the queen, the game ends.
- **After a wave.** If the player chose Defend, the mix goes back to the one set before the warning when the last hornet of that wave is dead or gone, not after a set time. A notice says so, with the defenders lost, and offers "Keep Defend", which puts the Defend mix back. Bees are not moved back by themselves; the player can click Match the mix now.
- **Time.** The simulation advances in fixed steps (ticks); a day is a fixed number of ticks, set in `game/data/balance.js`. Real time, with pause (Space) and two speeds (keys 1 and 2); speed changes only how many ticks run per second, never what happens in a tick. One season is a fixed number of in-game days, sized so that a game takes 15 to 25 minutes at normal speed (John's answer to question 2).
- **Points.** John's four measures, each shown live on screen and added up at the end: colony size (living bees), honey made over the game, honeycomb (comb cells built) and hive size (chambers). The end screen shows each part, the total, how the game ended, the seed, "Copy game record", "Play again" and "Replay this seed".
- **Seed.** Every game has a seed shown on screen. The same seed and the same choices at the same ticks give the same game. A new game picks a new seed unless the player types one, or the page is opened as `game/index.html?seed=<n>`, which starts on seed n.
- **Game record.** The seed plus every choice the player made, each with the tick it took effect, written as text that `node game/sim/run.js --record <file>` reads. Pauses and speed changes are not in it, because they do not change the game. A warning answer has the tick of its warning, since the game is paused while the player answers.
- **How to play.** The title screen shows the seed, three lines on how to play and a How to play button. The help screen is reachable at any time and a first-time player can read it before starting.

### Built so it can be checked
- The simulation (the rules) is separate from drawing and input, and runs without a browser. The browser game drives the same simulation code.
- `node game/sim/run.js --seed <n> --strategy <name>` plays a whole season with a stored strategy and prints how the game ended, the four score parts and the total. `--record <file>` replays a game record instead. `--log` adds, for each day, the warnings, the answer given, the wave's outcome, mix changes, hand-picked eggs and laying-stopped notices, and the eggs laid of each caste. `--list-strategies` prints each stored strategy's name with one line on what it does.
- Strategies are data in the same form as a game record: timed choices, plus a rule for answering warnings (for example "always Keep my mix").
- All balance numbers, the four mixes among them, live in one data file, `game/data/balance.js`; the rules read them from there.
- Tests run with `node --test game/tests/`.

## Acceptance
Each check has a yes or no answer. "The 20 held-out seeds" are the seeds in the seed file under `game/tests/` (check 17).

1. `docs/game-design.md` exists and covers the player and the five kinds of choice, the six castes, the resources, the life cycle, the meadow, the hornets and the warning, the end of a game, the points and the game record.
2. Opening `game/index.html` from disk in current desktop Chrome, with the network off, shows the title screen with the seed and a How to play button, then a game that starts on one click, with no errors in the browser console.
3. A new game starts on the Grow mix, and the shares shown match Grow's shares in `game/data/balance.js`. Clicking each of Grow, Gather, Defend and Balanced sets all six shares to that mix in one click, and plus or minus on a caste changes only that caste's share.
4. With one mix held for a whole season, no hand-picked eggs and every warning answered Keep my mix, `node game/sim/run.js --log` shows the eggs laid of each caste within one egg of the mix's share of all eggs laid.
5. In the browser, picking a caste for the next egg makes that egg hatch as that caste, and the egg after it follows the mix again. The player can do this at any time during play.
6. "Match the mix now" shows one line naming every move before anything happens, and after Move, the adult bees of each caste are within one of the mix's share of all adults. At no point does the game ask the player to choose a bee or a number of bees.
7. During a game, the player can see each caste doing its job: comb cells and chambers being added, larvae fed, dirty cells cleaned, nectar and pollen carried in, nectar turned into honey, a new patch found by a scout, and defenders fighting hornets.
8. At least three hornet waves arrive in a full season, each larger than the one before, and a scout gives warning before at least one of them.
9. Each warning pauses the game and shows the wave's size, when it arrives, the defender count, Defend and Keep my mix; the game does not go on until one is clicked. Defend switches to the Defend mix and matches the mix at once.
10. After a wave answered with Defend, the mix goes back to the one before the warning at the tick the last hornet of that wave is dead or gone; a notice says so and offers Keep Defend, and clicking it puts the Defend mix back.
11. When the queen stops laying, a notice names the cause and offers a fix, and clicking the fix adds one share to the caste it names.
12. The four score parts and the total are on screen during play and on the end screen.
13. A game ends in one of two ways, the season ending or the queen dying; the end screen says which and shows the seed, Copy game record, Play again and Replay this seed.
14. `node game/sim/run.js` gives the same output twice for the same seed and strategy, and for the same game record.
15. For two browser games played to the end, one at each speed, each with at least one mix change, one hand-picked egg and one warning answered, replaying the copied game record with `node game/sim/run.js --record <file>` prints the same ending, the same four score parts and the same total as the browser's end screen.
16. Opening `game/index.html?seed=<n>` starts a game on seed n, and the seed shown on screen is n.
17. The 20 held-out seeds were drawn after tuning stopped: the last commit that changes `game/data/balance.js` is an ancestor of the commit that first added the seed file. Checked with `git merge-base --is-ancestor $(git log -1 --format=%H -- game/data/balance.js) $(git log --diff-filter=A --format=%H -- <seed file> | tail -1)`, which exits 0.
18. Over the 20 held-out seeds, three stored strategies give these results:
    - "No defenders" loses the queen before the season ends in at least 15.
    - "Balanced" survives the season in at least 15.
    - "Change nothing" (Grow throughout, every warning answered Keep my mix, no hand-picked eggs) loses the queen in at least 15.
19. Over the same 20 seeds, "Balanced" scores higher than a stored "lay nothing after the start" strategy in all 20. (The player's choices matter.)
20. A full game at normal speed lasts between 15 and 25 minutes, not counting time paused, when the queen survives.
21. `node game/sim/run.js --list-strategies` names every stored strategy, and `--log` prints for each day the items listed under "Built so it can be checked".
22. `node --test game/tests/` passes.

## Checks every feature passes (hive/PROJECT.md)
1. **Nothing about one particular case in the code.** No seed, map layout, mix or tuned number is written into the rules or drawing code; seeds come from the player, the page address or a random draw, and balance numbers, the four mixes among them, come from `game/data/balance.js`. The 20 held-out seeds live in a data file under `game/tests/`. Check: a reviewer searches the files under `game/sim/` and the drawing code for numbers other than 0 and 1, and every one found has a comment saying why it is not balance.
2. **It works on a case it was not built on.** Two ways. First, the 20 held-out seeds in checks 18 and 19 are drawn after tuning stops, and check 17 proves it from git history. Second, before the epic closes, a product reviewer who did none of the building plays one full game in the browser on a seed drawn after the last commit, and records the seed, the end screen, the game record and what went wrong.
3. **No worse than today.** There is no game today, so there is nothing to compare at first. The parts that make a judgment are the balance, the four mixes and the hornet behaviour. From the first release on, any later change to any of them runs old and new on the same 20 held-out seeds and stored strategies, and an agent that did none of the work reads the two sets of results without knowing which is which.

## How it serves the product test
The product test (hive/strategy/PRODUCT-TEST.md) asks whether a person who plays for a week on their own would keep playing, and what made them want to stop. This prototype makes that test possible: it runs with nothing to install, every game is different through its seed, a game is short enough to play several times in a sitting, and the end screen gives the score parts, the seed and a game record, so a player can say what went wrong and on which game, and an assistant can replay it.

The design document names the three things most likely to make a player stop, and what the design does about each:
- **Clicking once per egg.** The colony mix lays without clicks; a hand-picked egg is there when the player wants it (checks 3 to 5).
- **Losing to hornets with no warning.** Every warning pauses the game (check 9).
- **Too little to do between waves.** The design offers mix changes, hand-picked eggs and Match the mix now between waves, and a player who changes nothing loses (check 18). No check shows that these choices are interesting to make; only the product test can show that, and the product reviewer's report (check 2 above) records whether there was anything to decide between waves.

## DECIDED
John's answers are in "John's answers" below, not here.

- DECIDED: Six castes: builder, nurse, forager, honeymaker, scout, defender. Nurses cover tending and cleaning; foragers cover getting pollen. (goal: every job John named has a caste)
- DECIDED: The score has exactly John's four parts: colony size, honey made, honeycomb, hive size. Hornets fought are not scored. (goal: John's list of what earns points)
- DECIDED: The design comes first, as `docs/game-design.md`, and the prototype follows it. (goal: "You need to design it, and then I want you to make a playable game")
- DECIDED: The prototype is one page that runs from disk in a desktop browser, with no install, server, network or outside library. (goal: "working, in-browser, playable prototype"; no spend)
- DECIDED: Real time with pause and two speeds; the simulation runs in fixed ticks that speed does not change. (goal: playable more than once in a sitting, and a game that replays exactly)
- DECIDED: Hornets come in waves that grow, and can end the game by killing the queen. (goal: "onslaughts of murder hornets")
- DECIDED: A hornet warning pauses the game and is answered in one click; after Defend, the mix goes back when the wave is over, not after a set time. (goal: the product test's "losing to hornets with no warning")
- DECIDED: Moving bees between castes is the one-click "Match the mix now"; the game never asks which bee or how many. (goal: the product test's "clicking once per egg", which applies equally to clicking once per bee)
- DECIDED: The game record stores each choice by tick, and a replayed record must reproduce the browser's end screen (check 15). (goal: an assistant explains the game the player played)
- DECIDED: The held-out seeds are proved held out by git history (check 17). (goal: hive/PROJECT.md check 2)
- DECIDED: The page reads a seed from its address (`?seed=<n>`). (goal: an assistant can hand the player a game to try again)
- DECIDED: Shapes and colour only; no drawn art, sound or music. (goal: "a first prototype")
- DECIDED: Desktop browser with mouse and keyboard only; phones and touch are not supported. (goal: "a first prototype")
- DECIDED: No saved games, accounts, leaderboard or multiplayer. (goal: "a first prototype"; no spend)

## John's answers
John added `approved_spec` to the first brief, which accepts its recommendations for these three questions, and answered how the queen chooses castes in a comment.

1. **Who the player is.** The queen bee (recommended answer). How she chooses castes: **both**, a colony mix by default and a hand-picked caste for the next egg at any time (John's comment on issue #1).
2. **How long a game lasts.** One season, ending with a score, of 15 to 25 minutes at normal speed (recommended answer).
3. **Online or not.** The prototype stays in the repository and John opens it from disk; it is not put online (recommended answer).
4. **The design changes made after approval** (warning pause, mix going back after a wave, one-click "Match the mix now", copyable game record, seed in the page address): **build them** (recommended answer, given to the lead in session on 2026-11-12).


## What the user does

The changes this section first proposed are now part of "Design" and "Acceptance" above, with John's answer on queen control added.

### The steps

The player does five things. The table counts the decisions in one full game with three hornet waves. "Before" means the first draft of this spec (a caste picked per egg, a standing order of six numbers, bees moved one at a time), and "after" means the design above.

| What the player does | Decisions before | Decisions after | If the player does nothing |
|---|---|---|---|
| Start a game | 2: type a seed or not, read help or not | 0 | Not possible: a first click on "Start" is needed. The game uses a new seed and the Grow mix. |
| Decide what bees to make | 6 to set the standing order, then 1 per egg picked by hand | 0 needed; 1 per mix change chosen; 1 per egg picked by hand, if the player wants | The queen keeps laying to the Grow mix. |
| Answer a hornet warning | 6 to rewrite the standing order, plus 3 per bee move (from, to, how many), so 9 per wave, or 27 in a game | 1 per wave, or 3 in a game | The game stays paused on the warning until the player answers. |
| Go back after a wave | 6 per wave, or 18 in a game | 0; the game goes back by itself, and "Keep Defend" undoes that | The mix goes back to what it was before the warning. |
| Finish and play again | 1: new seed or same seed | 1 | The end screen stays up. |
| **Total, one game** | **about 54, plus 1 per egg picked by hand** | **4 needed: 3 warnings and 1 "play again"; more if the player chooses** | The colony grows and then loses the queen to a later wave. |

The steps, in the player's own words:

1. **Start.** "I open `game/index.html`. The title screen shows the seed, three lines on how to play and a How to play button. I click Start."
2. **Watch and steer.** "My bees get to work. If I want more honey, I click Gather. If I want to tune it, I press plus on Honeymaker. If I need a scout right now, I pick Scout for the next egg." Space pauses the game, and 1 and 2 set the speed. A one-line notice explains anything that stops the queen from laying, together with the fix: "The queen has stopped laying: no clean cells. More nurses would clean them. [Add nurses]". Add nurses adds one nurse share and can be undone with minus.
3. **Answer a warning.** "A scout spots hornets and the game pauses." The player sees:
   > Hornets in 2 days: about 14. You have 4 defenders.
   > [Defend] lays defenders first and moves 6 bees to defence now.
   > [Keep my mix]
   "I click Defend."
4. **After the wave.** When the last hornet of the wave is dead or gone, the game shows: "Wave beaten. 3 defenders lost. Your mix is back to Gather. [Keep Defend]". "I carry on."
5. **End.** The end screen shows how the game ended (the season ended, or the hornets killed the queen), the four score parts, the total, the seed and "Copy game record". "I click Play again, or Replay this seed to try it differently."

What the player is asked to accept, with what they would have seen before:
- **At the warning.** Before: nothing would stop the game, and a player at fast speed could miss the scout's warning. After: the paused prompt above, with the numbers the player needs to judge it.
- **On "Match the mix now".** Before: a from, to and how-many choice for each move. After: one line, "Move 4 foragers and 2 builders to defence. [Move] [Cancel]".
- **After the wave.** Before: the player rewrote the standing order. After: the "Wave beaten" notice above.

### By assistant

The game runs from disk with no server, so an assistant cannot play a live game in the player's browser. It works through the simulation and the game record, and those offer the same choices as the screen: mixes, fine-tuning, hand-picked eggs, Match the mix now, an answer to each warning, and the seed.

> **Player:** I lost the queen on day 41. Here's my game record. What went wrong?
> **Assistant:** (replays the record with `--log`) You answered all three warnings with "Keep my mix". The third wave had 22 hornets against your 5 defenders.
> **Player:** Would Defend on the third one have saved me?
> **Assistant:** (replays the record with that one answer changed) Yes. The queen survives and your total goes from 0 to 1,840 [example figures]. Want the seed to try it yourself?
> **Player:** Yes.
> **Assistant:** Open `game/index.html?seed=48213`.

The assistant needs these tools, all listed under "Built so it can be checked" and checked in "Acceptance":

| Tool | Takes | Returns |
|---|---|---|
| Run a season: `node game/sim/run.js` | a seed and a strategy name, or a game record file (`--record`) | how the game ended, the four score parts and the total |
| The same command with `--log` | the same inputs | for each day: warnings, the answer given, the wave's outcome, mix changes, hand-picked eggs, notices that laying stopped, and eggs laid of each caste |
| The same command with `--list-strategies` | nothing | the name of each stored strategy, with one line on what it does |
| Open a seed: `game/index.html?seed=<n>` | a seed | the browser game started on that seed |
| Copy game record (on the end screen) | a click by the player | the seed and every choice, with its tick, as text the first command reads |

### Tested on a different field

The same steps were tried on a made-up hospital ward. A charge nurse staffs a ward from six roles, and the emergency department warns of patient surges. Before the change, the nurse assigns each new hire a role and rewrites the staffing after every surge. After it, the ward runs on a staffing mix. A surge warning offers "Surge staffing" or "Keep", and staffing goes back by itself after the surge. The steps held, with one finding. Staffing must go back when the surge is over, not after a set time, or a long surge leaves the ward short. In the game, this means the mix goes back when the last hornet of the wave is dead or gone, not after a set number of days (Design, "After a wave"; check 10).
