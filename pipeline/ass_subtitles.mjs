import fs from 'node:fs';

export function generateKineticAss(wordTimestamps, outputPath) {
  const header = `[Script Info]
Title: Kinetic Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BorderStyle,Outline,Alignment
Style: Default,Impact,60,&H00FFFFFF,&H0000FFFF,&H00000000,1,3,2

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;
  const lines = wordTimestamps.map(w => {
    const start = new Date(w.start * 1000).toISOString().substr(11, 8);
    const end = new Date(w.end * 1000).toISOString().substr(11, 8);
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\k${Math.round((w.end - w.start) * 100)}${w.word}}`;
  });
  fs.writeFileSync(outputPath, header + lines.join('\n'));
}