const fs = require('fs');
let c = fs.readFileSync('src/pages/BrowseView.tsx', 'utf8');

c = c.replace(
  /                   const frontText = stripHtml\(card.front\);\n                 const backText = stripHtml\(card.back\);/,
  "                  const getFirstImage = (html: string) => {\n                    const match = html.match(/<img[^>]+src=\\\"([^\\\">]+)\\\"/);\n                    return match ? match[1] : null;\n                  };\n\n                  const frontImg = getFirstImage(card.front) || getFirstImage(card.back);\n                  const frontText = stripHtml(card.front);\n                  const backText = stripHtml(card.back);"
);

c = c.replace(
  /                             <span className={cn\(!expandAll \? "line-clamp-1" : "whitespace-pre-wrap break-words max-w-lg", card.isSuspended \? "opacity-50 line-through" : ""\)}>{frontText \|\| '\(Empty\)'}<\/span>/g,
  `                             {frontImg && ( <button onClick={(e) => { e.stopPropagation(); setPreviewCardId(card.id); }} className="w-10 h-7 rounded border border-ui-border overflow-hidden shrink-0 flex items-center justify-center bg-black/50 hover:bg-black/30 transition-colors cursor-pointer" title="Preview images"><img src={frontImg} alt="Preview" className="max-w-full max-h-full object-contain" /></button> )}\n                             <span className={cn(!expandAll ? "line-clamp-1" : "whitespace-pre-wrap break-words max-w-lg flex-1", card.isSuspended ? "opacity-50 line-through" : "")}>{frontText || (frontImg ? "[Image]" : "(Empty)")}</span>`
);

fs.writeFileSync('src/pages/BrowseView.tsx', c);
