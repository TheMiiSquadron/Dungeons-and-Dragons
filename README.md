# Dungeons-and-Dragons

Static tabletop tools for D&D 5E and Pathfinder.

## Structure

- `index.html` is the landing page for the toolbox.
- `dnd/` contains the D&D 5E pages.
- `pathfinder/` contains the Pathfinder pages.
- `assets/` contains shared styles.
- `data/` contains the JSON data used by the monster and spell tools.
- `scripts/` contains Node scripts for regenerating D&D data.
- `docs/notes.txt` keeps the Pathfinder reference note that was previously at the repo root.

## Development

Open `index.html` in a local static server so the JSON-backed tools can load their data files correctly.

```bash
npm run build:data
```

The data build scripts require Node 18+ because they use the built-in `fetch` API.
