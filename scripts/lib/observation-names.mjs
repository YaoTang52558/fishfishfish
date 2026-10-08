// Short common labels retain species identity through formal names and searchable aliases.
const names = {
  'penaeus-monodon': '虎虾', 'penaeus-japonicus': '车虾', 'penaeus-merguiensis': '香蕉虾',
  'pandalus-borealis': '北极甜虾', 'oratosquilla-oratoria': '皮皮虾',
  'scylla-serrata': '青蟹', 'portunus-pelagicus': '花蟹', 'charybdis-feriata': '红花蟹',
  'cancer-pagurus': '面包蟹', 'paralithodes-camtschaticus': '红帝王蟹',
  'sepioteuthis-lessoniana': '大鳍鱿鱼', 'loligo-vulgaris': '欧洲鱿鱼', 'dosidicus-gigas': '洪堡鱿鱼',
  'sepia-officinalis': '普通墨鱼', 'enteroctopus-dofleini': '北太平洋大章鱼',
  'babylonia-areolata': '花螺', 'rapana-venosa': '脉红螺',
  'ruditapes-philippinarum': '花蛤', 'perna-viridis': '青口贝', 'mytilus-edulis': '蓝贻贝',
  'magallana-gigas': '太平洋生蚝', 'tegillarca-granosa': '血蚶', 'sinonovacula-constricta': '蛏子',
  'apostichopus-japonicus': '仿刺海参', 'mesocentrotus-nudus': '北紫海胆',
  'salmo-salar': '大西洋三文鱼', 'paralichthys-dentatus': '夏鲆',
  'trachinotus-blochii': '金鲳', 'eleutheronema-tetradactylum': '马友',
};
export const childName = (record) => names[record.id] ?? record.name.replace(/（.*?）/g, '');
