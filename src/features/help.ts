export const helpTopics = {
  'arm-pose': { icon: '👆', title: '摆一条腕足', text: '先点数字选一条腕足，再拖黄色圆点，拉长或转个方向。用滑杆可以卷一卷、沿肚子挪位置。点全部，可以一起改。点弯箭头，可以撤销。' },
  arms: { icon: '🦑', title: '加腕足', text: '先选几条腕足，再拖一拖长短和卷曲。点颜色，就能给腕足换色。想看它摆动，点试游。点弯箭头，可以撤销。' },
  sculpt: { icon: '🤏', title: '捏一捏', text: '上下拖动鱼背和肚子上的圆点。捏错了，点弯箭头就能回去。' },
  shape: { icon: '🧩', title: '换部件', text: '点鱼旁边的部件，再挑一个。你的笔迹还会留着。' },
  colors: { icon: '🎨', title: '涂颜色', text: '先选身体、尾巴或鳍，再点一种颜色。也可以试试不同花纹。' },
  brush: { icon: '🖌️', title: '自由画', text: '选画笔和颜色，用手指在鱼身上画。点弯箭头，可以撤销。' },
  trial: { icon: '🐟', title: '试试看', text: '看看你造的鱼怎么游。随时回去改，也可以直接入海。' },
  save: { icon: '🌊', title: '入海', text: '给小伙伴起个名字，再点入海。改旧鱼时，更新会保留原来的位置，另存会多出一条鱼。' },
  cast: { icon: '🎣', title: '抛竿', text: '先选鱼饵，再点近处、中段或远处，把鱼饵抛过去。' },
  bite: { icon: '❗', title: '等咬钩', text: '看浮漂。它沉下，出现咬钩了，就点提竿。轻轻动一下，先等等。' },
  fight: { icon: '◉', title: '收线与放线', text: '鱼喘息时，按住中间的鼓轮收线。鱼冲刺或鱼线太紧时，松开手就放线。横游时，点另一边的箭头。' },
  land: { icon: '🐟', title: '轻轻抄起', text: '鱼到岸边了，轻轻抄起。看看它，再把它放回大海。' },
  catch: { icon: '🌈', title: '钓到啦', text: '钓到啦！看看这位鱼朋友，再轻轻把它放回大海。' },
  shrimp: { icon: '🦐', title: '虾型饵', text: '虾型饵，在游戏里更容易遇到喜欢虾型饵的鱼。换一种饵，机会就会变。' },
  algae: { icon: '🌿', title: '藻食型饵', text: '藻食型饵，在游戏里更偏向藻食鱼。每种饵都有机会，不保证钓到哪一种。' },
  lure: { icon: '🐠', title: '拟饵', text: '拟饵是假鱼饵。游戏里，它更偏向喜欢拟饵的鱼，不一定钓到大鱼。' },
} as const;
export type HelpTopic = keyof typeof helpTopics;
export const helpAudio = (topic: HelpTopic) => `${import.meta.env.BASE_URL}audio/vo-help-${topic}.wav`;
