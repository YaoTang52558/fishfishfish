import { createFishDesign } from '../domain/fish.ts';
import type { BaitId, FightPattern, SpeciesGame } from '../domain/fishing.ts';
import type { ColorSlot, FishDesign, HabitatId } from '../domain/types.ts';

/*
 * 真实物种资料（步骤 08）。生物学内容与游戏配置分开：
 * facts/realDiet/realHabitat 等来自已核对的来源；game 中的权重、阻力只是难度设定。
 * 外形用拼接部件近似绘制，每种鱼使用不同的部件组合，不共用一张图。
 */
export interface SpeciesFact { text: string; sourceUrl: string; checkedAt: string }
export interface SpeciesDefinition {
  id: string;
  commonNameZh: string;
  popularNameZh?: string;
  scientificName: string;
  appearance: string;
  realDiet: string;
  realHabitat: string;
  maxLengthCm?: number;
  facts: SpeciesFact[];
  observation: { question: string; answer: string };
  sources: Array<{ url: string; checkedAt: string }>;
  reviewStatus: 'placeholder' | 'verified';
  render: {
    bodyId: string; parts: FishDesign['parts']; shape?: Partial<FishDesign['shape']>;
    colors: Record<ColorSlot, string>; pattern: FishDesign['pattern'];
  };
  game: SpeciesGame;
}

const checkedAt = '2026-10-05';
const src = (...urls: string[]) => urls.map((url) => ({ url, checkedAt }));
const fact = (text: string, sourceUrl: string): SpeciesFact => ({ text, sourceUrl, checkedAt });
/** 游戏设定：主饵权重 3，其余 1；落点与阻力类型只是难度配置。 */
const game = (habitatId: HabitatId, bait: BaitId, fightPattern: FightPattern, size: 'small' | 'large', cast: [number, number, number], baseWeight = 1): SpeciesGame => ({
  habitatId, fightPattern, size, baseWeight,
  baitWeights: { shrimp: 1, algae: 1, lure: 1, [bait]: 3 } as Record<BaitId, number>,
  castWeights: { near: cast[0], middle: cast[1], far: cast[2] },
});
const FB = 'https://www.fishbase.se/summary/';
// 中国物种名录与中国动物志站点只提供 HTTP。
const COL = 'http://col.especies.cn/species/show_species_details/';
const SP2000 = 'http://www.sp2000.org.cn/Fauna/fauna/detil/';
const TW = 'https://catalog.digitalarchives.tw/item/00/42/';

export const species: readonly SpeciesDefinition[] = [
  {
    id: 'amphiprion-ocellaris', commonNameZh: '眼斑双锯鱼', popularNameZh: '公子小丑', scientificName: 'Amphiprion ocellaris',
    appearance: '身体橙色，头部、身体中部和尾柄各有一条白色宽带，白带边有细黑线，鳍上有黑边',
    realDiet: '吃藻类、桡足类、等足类和浮游动物', realHabitat: '印度-西太平洋珊瑚礁，住在大型海葵中，水深约 3–15 米', maxLengthCm: 11,
    facts: [
      fact('适应特定的宿主海葵后，它身上的黏液帮助抵御海葵触手的蜇刺。', 'https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/clown-anemonefish/'),
      fact('如果雌鱼死了，群里体型最大的雄鱼会变成雌鱼。', 'https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/clown-anemonefish/'),
    ],
    observation: { question: '真实的眼斑双锯鱼身上有几条白色宽带？', answer: '3 条：头部、身体中部和尾柄各一条。' },
    sources: src(`${FB}Amphiprion-ocellaris.html`, 'https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/clown-anemonefish/', 'https://australian.museum/learn/animals/fishes/western-clown-anemonefish-amphiprion-ocellaris-cuvier-1830/', `${COL}4dec8c9204ce428b9553954abae3d913`),
    reviewStatus: 'verified',
    render: { bodyId: 'streamlined', parts: { headId: 'rounded', tailId: 'fan', finId: 'soft', eyeId: 'round', mouthId: 'smile' }, shape: { length: 0.9, height: 1.1 },
      colors: { body: '#F4BA75', head: '#F4BA75', fin: '#F4BA75', tail: '#F4BA75' }, pattern: { id: 'bands', primary: '#FFF3D9', secondary: '#24486B' } },
    game: game('reef-edge', 'shrimp', 'steady', 'small', [1.6, 1, 0.6]),
  },
  {
    id: 'zebrasoma-flavescens', commonNameZh: '黄高鳍刺尾鱼', popularNameZh: '三角倒吊', scientificName: 'Zebrasoma flavescens',
    appearance: '身体高而侧扁、近椭圆形，全身亮柠檬黄，嘴小吻突出，背鳍大，尾柄有白色小刺',
    realDiet: '主要啃食藻类', realHabitat: '太平洋（日本至夏威夷）珊瑚礁潟湖和外礁，水深约 2–46 米', maxLengthCm: 20,
    facts: [
      fact('它尾巴根部有一根白色的刺，像一把小手术刀。', 'https://www.waikikiaquarium.org/experience/animal-guide/fishes/surgeonfishes/yellow-tang/'),
      fact('晚上它的亮黄色会变暗，沿身体中线出现一条白色宽带。', 'https://www.waikikiaquarium.org/experience/animal-guide/fishes/surgeonfishes/yellow-tang/'),
    ],
    observation: { question: '真实的黄高鳍刺尾鱼，尾巴根部的小刺是什么颜色？', answer: '白色。它全身只有这根刺不是黄色。' },
    sources: src(`${FB}Zebrasoma-flavescens.html`, 'https://www.waikikiaquarium.org/experience/animal-guide/fishes/surgeonfishes/yellow-tang/', 'https://www.georgiaaquarium.org/animal/yellow-tang/', `${COL}450888c1549c4d858ae52134367fc4dc`),
    reviewStatus: 'verified',
    render: { bodyId: 'compressed', parts: { headId: 'pointed', tailId: 'truncate', finId: 'sail', eyeId: 'round', mouthId: 'kiss' },
      colors: { body: '#EAC779', head: '#EAC779', fin: '#EAC779', tail: '#EAC779' }, pattern: { id: 'none', primary: '#FFF3D9', secondary: '#EAC779' } },
    game: game('reef-edge', 'algae', 'wave', 'small', [1.2, 1.2, 0.8]),
  },
  {
    id: 'paracanthurus-hepatus', commonNameZh: '黄尾副刺尾鱼', popularNameZh: '蓝倒吊', scientificName: 'Paracanthurus hepatus',
    appearance: '身体蓝色侧扁，体侧有像调色板的黑色花纹，尾鳍黄色，上下边缘是黑色',
    realDiet: '主要吃浮游动物', realHabitat: '印度-太平洋外礁，水流冲刷的礁台上方，水深约 2–40 米', maxLengthCm: 31,
    facts: [
      fact('受惊时，它会把身体紧紧卡进珊瑚枝之间。', 'https://www.georgiaaquarium.org/animal/palette-surgeonfish/'),
      fact('它尾柄两侧各有一根锋利的刺，带有轻微毒性。', 'https://www.georgiaaquarium.org/animal/palette-surgeonfish/'),
    ],
    observation: { question: '真实的黄尾副刺尾鱼，尾鳍是什么颜色？', answer: '黄色，上下边缘是黑色。' },
    sources: src(`${FB}Paracanthurus-hepatus.html`, 'https://australian.museum/learn/animals/fishes/blue-tang-paracanthurus-hepatus/', 'https://www.georgiaaquarium.org/animal/palette-surgeonfish/', `${COL}619bc8feea17467fa752c9ad30c703ec`),
    reviewStatus: 'verified',
    render: { bodyId: 'compressed', parts: { headId: 'rounded', tailId: 'truncate', finId: 'spiny', eyeId: 'round', mouthId: 'smile' }, shape: { height: 0.85 },
      colors: { body: '#8AAFB0', head: '#8AAFB0', fin: '#24486B', tail: '#EAC779' }, pattern: { id: 'lines', primary: '#24486B', secondary: '#EAC779' } },
    game: game('reef-edge', 'shrimp', 'burst', 'small', [0.6, 1, 1.6]),
  },
  {
    id: 'forcipiger-flavissimus', commonNameZh: '黄镊口鱼', popularNameZh: '火箭蝶', scientificName: 'Forcipiger flavissimus',
    appearance: '身体亮黄色侧扁，嘴又细又长，头上半部黑色、下半部银白，臀鳍上有一个黑点',
    realDiet: '吃海胆管足、多毛类触手、水螅、小型甲壳类和鱼卵', realHabitat: '印度-太平洋和东太平洋外礁、潟湖礁，水深 0–145 米', maxLengthCm: 22,
    facts: [
      fact('它的名字里有“镊子”的意思，因为它的嘴像一把长镊子。', 'https://www.waikikiaquarium.org/experience/animal-guide/fishes/butterflyfishes/forceps-butterflyfish/'),
      fact('它常常两条一起成对活动。', 'https://australian.museum/learn/animals/fishes/forceps-fish-forcipiger-flavissimus/'),
    ],
    observation: { question: '真实的黄镊口鱼，靠近尾巴下方的鳍上有几个黑点？', answer: '1 个。' },
    sources: src(`${FB}Forcipiger-flavissimus.html`, 'https://australian.museum/learn/animals/fishes/forceps-fish-forcipiger-flavissimus/', 'https://www.waikikiaquarium.org/experience/animal-guide/fishes/butterflyfishes/forceps-butterflyfish/', `${COL}5372936d15314221b609fa22e2f4efb3`),
    reviewStatus: 'verified',
    render: { bodyId: 'compressed', parts: { headId: 'pointed', tailId: 'truncate', finId: 'spiny', eyeId: 'dot', mouthId: 'beak' }, shape: { headRatio: 0.34 },
      colors: { body: '#EAC779', head: '#24486B', fin: '#EAC779', tail: '#EAC779' }, pattern: { id: 'eyespot', primary: '#24486B', secondary: '#FFF3D9' } },
    game: game('reef-edge', 'shrimp', 'steady', 'small', [1, 1.3, 0.8], 0.8),
  },
  {
    id: 'arothron-hispidus', commonNameZh: '纹腹叉鼻鲀', popularNameZh: '白点河鲀', scientificName: 'Arothron hispidus',
    appearance: '身体圆胖，背部绿褐色布满白色小圆点，腹部有白色条纹，胸鳍根部绕着深浅相间的环',
    realDiet: '杂食：藻类、珊瑚、海绵、海星、软体动物和蟹等', realHabitat: '印度-太平洋，从河口、礁坪、潟湖到外礁坡，水深 1–50 米', maxLengthCm: 50,
    facts: [
      fact('它身体上侧和尾鳍有白色小点，下侧有浅色线纹。', 'https://australian.museum/learn/animals/fishes/stars-and-stripes-toadfish-arothron-hispidus-linnaeus-1758/'),
      fact('它的皮肤和内脏里有河鲀毒素，这种毒可能致命。', 'https://australian.museum/learn/animals/fishes/stars-and-stripes-toadfish-arothron-hispidus-linnaeus-1758/'),
    ],
    observation: { question: '真实的纹腹叉鼻鲀，背上有什么样的花纹？', answer: '许多白色小圆点。' },
    sources: src(`${FB}Arothron-hispidus.html`, 'https://australian.museum/learn/animals/fishes/stars-and-stripes-toadfish-arothron-hispidus-linnaeus-1758/', 'http://www.sp2000.org.cn/Fauna/fauna/detil/23882', `${COL}2dcd4d806c72443c992c2038a3b9e567`),
    reviewStatus: 'verified',
    render: { bodyId: 'round', parts: { headId: 'rounded', tailId: 'fan', finId: 'nub', eyeId: 'round', mouthId: 'smile' },
      colors: { body: '#9EAF91', head: '#9EAF91', fin: '#9EAF91', tail: '#9EAF91' }, pattern: { id: 'spots', primary: '#FFF3D9', secondary: '#8AAFB0' } },
    game: game('reef-edge', 'shrimp', 'wave', 'large', [1.4, 1, 0.7]),
  },
  {
    id: 'zanclus-cornutus', commonNameZh: '角镰鱼', popularNameZh: '神像', scientificName: 'Zanclus cornutus',
    appearance: '身体圆盘状很扁，白黄底色配两条宽黑带，背鳍拉长成白色长丝，吻管状',
    realDiet: '用长吻在缝隙里吃海绵和珊瑚藻等', realHabitat: '印度-太平洋及东太平洋潟湖和珊瑚礁，水深 0–182 米', maxLengthCm: 23,
    facts: [
      fact('它是角镰鱼科里唯一的一种鱼。', 'https://australian.museum/learn/animals/fishes/moorish-idol-zanclus-cornutus-linnaeus-1758/'),
      fact('成年鱼两只眼睛前方有小小的骨质突起，雄鱼的更大。', 'https://australian.museum/learn/animals/fishes/moorish-idol-zanclus-cornutus-linnaeus-1758/'),
    ],
    observation: { question: '真实的角镰鱼，身上有几条宽宽的黑色带？', answer: '2 条。' },
    sources: src(`${FB}Zanclus-cornutus.html`, 'https://australian.museum/learn/animals/fishes/moorish-idol-zanclus-cornutus-linnaeus-1758/', 'https://www.waikikiaquarium.org/experience/animal-guide/fishes/moorish-idol/moorish-idol/', `${COL}fcb0aa2deb9041b6ba13a856d37d780c`),
    reviewStatus: 'verified',
    render: { bodyId: 'compressed', parts: { headId: 'pointed', tailId: 'lunate', finId: 'flowing', eyeId: 'round', mouthId: 'beak' }, shape: { length: 0.8, height: 1.2 },
      colors: { body: '#FFF3D9', head: '#FFF3D9', fin: '#FFF3D9', tail: '#24486B' }, pattern: { id: 'bands', primary: '#24486B', secondary: '#EAC779' } },
    game: game('reef-edge', 'shrimp', 'burst', 'small', [0.7, 1, 1.4], 0.7),
  },
  {
    id: 'sebastes-schlegelii', commonNameZh: '许氏平鲉', popularNameZh: '黑鲪', scientificName: 'Sebastes schlegelii',
    appearance: '身体长椭圆、侧扁，头大有棘，体灰黑色散布不规则黑斑，腹部白，尾鳍边缘白色',
    realDiet: '吃小鱼、甲壳类和等足类', realHabitat: '西北太平洋（黄渤海、东海、日本、朝鲜半岛）近岸岩礁和泥沙地带', maxLengthCm: 65,
    facts: [
      fact('它的宝宝在妈妈肚子里发育，一生下来就会游泳。', `${SP2000}23637`),
      fact('它的鳍刺有毒，被扎到会红肿、很疼。', `${SP2000}23637`),
    ],
    observation: { question: '真实的许氏平鲉，尾鳍边缘是什么颜色？', answer: '白色。' },
    sources: src(`${FB}Sebastes-schlegelii.html`, `${SP2000}23637`, `${COL}4951ad96901142f2beff89cb7783482b`),
    reviewStatus: 'verified',
    render: { bodyId: 'wedge', parts: { headId: 'brow', tailId: 'truncate', finId: 'spiny', eyeId: 'big', mouthId: 'upturned' },
      colors: { body: '#758F89', head: '#24486B', fin: '#758F89', tail: '#758F89' }, pattern: { id: 'spots', primary: '#24486B', secondary: '#FFF3D9' } },
    game: game('coastal-rock', 'lure', 'burst', 'large', [0.8, 1, 1.4]),
  },
  {
    id: 'acanthopagrus-schlegelii', commonNameZh: '黑棘鲷', popularNameZh: '黑鲷', scientificName: 'Acanthopagrus schlegelii',
    appearance: '身体椭圆形侧扁，灰黑色带银色光泽，有几条不明显的暗褐色横带，胸鳍橘黄色',
    realDiet: '吃软体动物、多毛类、底栖甲壳类和棘皮动物', realHabitat: '西北太平洋（日本、朝鲜半岛、中国沿海）内湾、浅岩礁和河口', maxLengthCm: 50,
    facts: [
      fact('它小时候是雄鱼，长大几年后会变成雌鱼。', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5893958/'),
      fact('它能生活在海水里，也会游进河口的半咸水。', `${TW}6e/36.html`),
    ],
    observation: { question: '真实的黑棘鲷，胸鳍是什么颜色？', answer: '橘黄色。其他鳍是暗灰褐色。' },
    sources: src(`${FB}Acanthopagrus-schlegelii.html`, `${TW}6e/36.html`, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5893958/', `${COL}a6d1fb5dbc5945aeb8955fedc120efad`),
    reviewStatus: 'verified',
    render: { bodyId: 'compressed', parts: { headId: 'pointed', tailId: 'fork', finId: 'spiny', eyeId: 'round', mouthId: 'smile' }, shape: { height: 0.8, length: 1.1 },
      colors: { body: '#758F89', head: '#758F89', fin: '#F4BA75', tail: '#758F89' }, pattern: { id: 'bands', primary: '#24486B', secondary: '#758F89' } },
    game: game('coastal-rock', 'shrimp', 'burst', 'large', [1.2, 1.2, 0.8]),
  },
  {
    id: 'hexagrammos-otakii', commonNameZh: '大泷六线鱼', popularNameZh: '欧氏六线鱼', scientificName: 'Hexagrammos otakii',
    appearance: '身体长椭圆略侧扁，黄褐至紫褐色，腹部灰白，体侧有云状斑，背鳍凹处有 1 个黑斑',
    realDiet: '幼鱼吃甲壳类，成鱼主要吃软体动物，也吃虾和小鱼', realHabitat: '黄海、渤海、东海及日本、朝鲜沿岸岩礁', maxLengthCm: 57,
    facts: [
      fact('它的身上有 5 条侧线。', `${SP2000}23527`),
      fact('鱼爸爸会守护卵直到孵化，守卵期间不吃东西。', `${SP2000}23527`),
    ],
    observation: { question: '真实的大泷六线鱼，背鳍中间凹下去的地方有几个黑斑？', answer: '1 个。' },
    sources: src(`${FB}Hexagrammos-otakii.html`, `${SP2000}23527`, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11735804/', `${COL}ae46a283c6bd42a7803923190ff54034`),
    reviewStatus: 'verified',
    render: { bodyId: 'streamlined', parts: { headId: 'pointed', tailId: 'truncate', finId: 'continuous', eyeId: 'round', mouthId: 'smile' }, shape: { length: 1.25, height: 0.85 },
      colors: { body: '#EAC779', head: '#EAC779', fin: '#758F89', tail: '#758F89' }, pattern: { id: 'waves', primary: '#758F89', secondary: '#FFF3D9' } },
    game: game('coastal-rock', 'shrimp', 'wave', 'large', [1.3, 1, 0.8]),
  },
  {
    id: 'oplegnathus-fasciatus', commonNameZh: '条石鲷', popularNameZh: '海胆鲷', scientificName: 'Oplegnathus fasciatus',
    appearance: '身体高而侧扁，黄褐色，连同穿过眼睛的一条共 7 条黑色竖带，牙齿愈合成鸟喙状',
    realDiet: '成鱼用喙状的牙齿吃螺、藤壶、贝类和海胆', realHabitat: '西北太平洋（日本、韩国、中国、台湾）近岸岩礁', maxLengthCm: 80,
    facts: [
      fact('它的牙齿长在一起，像鹦鹉的嘴，能咬碎贝壳和海胆壳。', `${TW}6c/9f.html`),
      fact('它的小鱼会躲在漂流的海藻里，吃浮游动物。', 'https://nas.er.usgs.gov/queries/FactSheet.aspx?SpeciesID=2902'),
    ],
    observation: { question: '真实的条石鲷，身上一共有几条黑色竖条纹（算上穿过眼睛的那条）？', answer: '7 条。长得很大的雄鱼条纹会变得不明显。' },
    sources: src(`${FB}Oplegnathus-fasciatus.html`, 'https://nas.er.usgs.gov/queries/FactSheet.aspx?SpeciesID=2902', `${TW}6c/9f.html`, `${COL}0676f3025acf4e3f8945e842aa99c36e`),
    reviewStatus: 'verified',
    render: { bodyId: 'compressed', parts: { headId: 'rounded', tailId: 'truncate', finId: 'spiny', eyeId: 'round', mouthId: 'beak' }, shape: { height: 1.05 },
      colors: { body: '#EAC779', head: '#EAC779', fin: '#EAC779', tail: '#EAC779' }, pattern: { id: 'bands', primary: '#24486B', secondary: '#24486B' } },
    game: game('coastal-rock', 'shrimp', 'steady', 'large', [1, 1.2, 1], 0.8),
  },
  {
    id: 'girella-punctata', commonNameZh: '斑鱾', popularNameZh: '黑毛', scientificName: 'Girella punctata',
    appearance: '身体长椭圆、侧扁，头短吻钝，全身灰褐到暗褐色，胸鳍根部有暗褐色斑',
    realDiet: '杂食：冬天以藻类为主，夏天捕食各种小型生物', realHabitat: '日本至中国东海（含台湾）近岸岩礁区，水深 1–30 米', maxLengthCm: 50,
    facts: [
      fact('它冬天主要吃藻类，夏天会捕食各种小动物。', `${TW}6b/6f.html`),
      fact('它的小鱼会跟着漂流的海藻一起生活。', `${FB}Girella-punctata.html`),
    ],
    observation: { question: '真实的斑鱾，胸鳍根部有什么颜色的斑？', answer: '暗褐色。它身上别的地方几乎没有斑点。' },
    sources: src(`${FB}Girella-punctata.html`, `${TW}6b/6f.html`, `${COL}256accf0ddc34c6ab848a83ef09710fd`),
    reviewStatus: 'verified',
    render: { bodyId: 'compressed', parts: { headId: 'square', tailId: 'truncate', finId: 'soft', eyeId: 'sleepy', mouthId: 'smile' }, shape: { height: 0.8, length: 1.1 },
      colors: { body: '#758F89', head: '#758F89', fin: '#758F89', tail: '#758F89' }, pattern: { id: 'countershade', primary: '#758F89', secondary: '#9EAF91' } },
    game: game('coastal-rock', 'algae', 'wave', 'large', [1.4, 1, 0.7]),
  },
  {
    id: 'sebastiscus-marmoratus', commonNameZh: '褐菖鲉', popularNameZh: '石狗公', scientificName: 'Sebastiscus marmoratus',
    appearance: '身体长椭圆侧扁，头大口大，体褐红色，体侧有 5～6 条褐色横纹，下半部散成云状',
    realDiet: '吃小鱼、蟹、虾、端足类、泥螺，也吃藻类', realHabitat: '西太平洋暖温水域，中国沿海近岸岩礁和海藻丛中', maxLengthCm: 36,
    facts: [
      fact('它喜欢待在岩礁和海藻丛里，活动范围不大。', `${SP2000}23643`),
      fact('它的鳍刺有毒，不要用手去摸。', `${SP2000}23643`),
    ],
    observation: { question: '真实的褐菖鲉，身体侧面有几条褐色横纹？', answer: '5～6 条，往下会散开成云一样的斑。' },
    sources: src(`${FB}Sebastiscus-marmoratus.html`, `${SP2000}23643`, `${TW}6f/31.html`, `${COL}247cc924139747dda762865e0840459d`),
    reviewStatus: 'verified',
    render: { bodyId: 'wedge', parts: { headId: 'flat', tailId: 'fan', finId: 'spiny', eyeId: 'big', mouthId: 'smile' },
      colors: { body: '#E9A598', head: '#E9A598', fin: '#E9A598', tail: '#E9A598' }, pattern: { id: 'zebra', primary: '#758F89', secondary: '#FFF3D9' } },
    game: game('coastal-rock', 'lure', 'steady', 'small', [1.4, 1, 0.7]),
  },
];

export function speciesById(id: string) { return species.find((item) => item.id === id) ?? null; }
export function speciesFor(habitatId: HabitatId) { return species.filter((item) => item.game.habitatId === habitatId && item.reviewStatus === 'verified'); }
/** 物种的示意外形：拼接部件 + 色卡颜色；不含笔迹和印章。 */
export function speciesDesign(item: SpeciesDefinition): FishDesign {
  const base = createFishDesign();
  return { ...base, bodyId: item.render.bodyId, parts: { ...item.render.parts }, shape: { ...base.shape, ...item.render.shape },
    colors: { ...item.render.colors }, pattern: { ...item.render.pattern } };
}
/** 未发现物种的剪影：同一外形，统一深色，不透露配色。 */
export function silhouetteDesign(item: SpeciesDefinition): FishDesign {
  const design = speciesDesign(item);
  const dark = '#175F57';
  return { ...design, colors: { body: dark, head: dark, fin: dark, tail: dark }, pattern: { id: 'none', primary: dark, secondary: dark } };
}
