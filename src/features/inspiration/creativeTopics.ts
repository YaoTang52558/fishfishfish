export type CreativeTopicId = 'mouth' | 'fin' | 'tail' | 'shape' | 'pattern' | 'arms' | 'shell';
export interface CreativeTopic {
  title: string; icon: string; label: string; focus: 'mouth' | 'whole' | 'tail' | 'body';
  examples: { id: string; keys: string[] }[];
  question: string; note: string; narration: string;
}
/** Observed features inspire drawing; they do not impose real anatomy on fantasy designs. */
export const creativeTopics: Record<CreativeTopicId, CreativeTopic> = {
  mouth: { title: '嘴巴有什么不同？', icon: '👄', label: '嘴巴', focus: 'mouth',
    examples: [{ id: 'forcipiger-flavissimus', keys: ['MOUTH'] }, { id: 'scarus-ghobban', keys: ['FOOD'] }],
    question: '长嘴巴，还是小鹦嘴？你也可以画一种新的。',
    note: '长嘴能探查礁缝，鹦嘴鱼会刮着吃藻类。不同物种有不同用法，你的幻想鱼可以有自己的故事。',
    narration: '看看这两张图。长嘴巴，还是小鹦嘴？你也可以画一种新的嘴巴。' },
  fin: { title: '鳍长在哪里？', icon: '🪽', label: '鱼鳍', focus: 'whole',
    examples: [{ id: 'zanclus-cornutus', keys: ['FIN'] }, { id: 'sphyraena-barracuda', keys: ['FINS'] }],
    question: '一条长长的鳍，还是两片小鳍？',
    note: '角镰鱼背上有长长的鳍条，大魣有分开的两片背鳍。观察以后，你可以创造自己的鳍。',
    narration: '看看鱼背上的鳍。一条长长的鳍，还是两片小鳍？你的鱼想要什么样的？' },
  tail: { title: '尾巴都一样吗？', icon: '↔️', label: '尾巴', focus: 'tail',
    examples: [{ id: 'hippocampus-kuda', keys: ['TAIL'] }, { id: 'trichiurus-lepturus', keys: ['TAIL'] }],
    question: '卷卷的尾巴，还是细细的尾巴？',
    note: '海马能用尾巴抓住东西，带鱼末端没有扇形尾鳍。创作里的游速是游戏设定，不等于真实鱼类运动规律。',
    narration: '卷卷的尾巴，还是细细的尾巴？看看这两位朋友，再给自己的鱼想一条尾巴。' },
  shape: { title: '身体可以像什么？', icon: '🐟', label: '身形', focus: 'body',
    examples: [{ id: 'ostracion-cubicus', keys: ['BODY'] }, { id: 'mobula-birostris', keys: ['FINS'] }],
    question: '小盒子，大翅膀。你的鱼像什么？',
    note: '黄箱鲀的身体像盒子，蝠鲼宽大的胸鳍像翅膀。捏一捏可以改变鱼背和肚子；现在还不能直接做出蝠鲼的完整结构。',
    narration: '小盒子，大翅膀。看看它们的身体。你的鱼想像什么？回去捏一捏，也可以用画笔画出想法。' },
  pattern: { title: '给它一件花衣服', icon: '🎨', label: '花纹', focus: 'body',
    examples: [{ id: 'penaeus-monodon', keys: ['BODY'] }, { id: 'babylonia-areolata', keys: ['BODY'] }],
    question: '一条条，还是一点点？也可以混在一起！',
    note: '虎虾腹部有深浅条带，花螺壳上有褐色方斑。借来的条纹和圆点是工坊的创意近似；真实形状可以看图再画。',
    narration: '看看虎虾的一条条，和花螺的一点点。你想给鱼画哪件花衣服？也可以把两种花纹混在一起。' },
  arms: { title: '长长的腕，怎么画？', icon: '🦑', label: '腕足', focus: 'whole',
    examples: [{ id: 'octopus-vulgaris', keys: ['BODY', 'DETAIL'] }, { id: 'loligo-vulgaris', keys: ['BODY', 'DETAILTWO'] }],
    question: '弯弯的线，加上小圆点，会变成什么？',
    note: '章鱼有八条腕；鱿鱼有八条腕和两条较长的触腕。工坊能给幻想鱼加一至八条可调、可换色的腕足，并在试游中摆动；画笔仍只画在鱼身上。吸盘结构和每条腕的独立摆放仍待制作。幻想鱼可以自由想象。',
    narration: '看看章鱼和鱿鱼的腕。回去点加腕足，选几条，再卷一卷。也可以用画笔画弯弯的线，试试新点子。' },
  shell: { title: '把壳变成新点子', icon: '🐚', label: '贝壳', focus: 'body',
    examples: [{ id: 'haliotis-discus', keys: ['BODY', 'DETAIL'] }, { id: 'pecten-maximus', keys: ['BODY', 'DETAIL'] }],
    question: '像耳朵，像扇子。你会画哪种？',
    note: '盘鲍背上是一片耳朵形的壳，大扇贝有两片扇形壳。可以画壳纹或放一枚贝壳印章；这不会把作品变成真实的贝类。',
    narration: '像耳朵，像扇子。看看鲍鱼和扇贝的壳。回去画一片想象的壳，也可以试试贝壳印章。' },
};
export const topicAudio = (id: CreativeTopicId) => `audio/vo-create-${id.toUpperCase()}.wav`.toLowerCase();
