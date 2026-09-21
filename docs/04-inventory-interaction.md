# Inventory staging interaction

Inventory movement is touch-only. A 300 ms hold on an occupied item opens its detail panel; moving farther than 18 px after the hold begins drag mode. A tap still selects an item for use or combat, but never moves it.

The first occupied cell of the rotated shape is the placement anchor. Green cells accept a drop, yellow cells replace the items there and move those conflicts to staging, and red cells reject the drop. Invalid release, touch cancellation, page blur, and visibility interruption leave the item at its original location.

While dragging, the upper area is split into a red discard zone (25 percent) and a blue free-form staging canvas (75 percent). Staged items may overlap but stay inside the canvas. The zones remain until staging is empty; clearing the staging canvas advances one organize turn. A second touch rotates the held item clockwise by 90 degrees and enters drag mode. Only the small and medium sprite variants are loaded at runtime.
