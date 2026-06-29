import type { StructuralKnowledgePoint, StructuralLearningLevel } from './structural-learning';
import { toolsTutorials } from './tools-tutorials';

export type ToolsLearningLevel = StructuralLearningLevel;
export type ToolsDifficulty = '零基础' | '基础';

export interface ToolsKnowledgePoint extends StructuralKnowledgePoint {
  difficulty: ToolsDifficulty;
  tutorialMarkdown: string;
  practiceStatus: 'collecting';
}

type TutorialSeed = {
  group: string;
  id: keyof typeof toolsTutorials;
  title: string;
  description: string;
  prerequisites: string[];
  difficulty: ToolsDifficulty;
  question: string;
};

const seeds: TutorialSeed[] = [
  {
    group: 'Python 入门',
    id: 'python-intro',
    title: '认识 Python',
    description: '理解 Python 是什么、代码如何运行，以及它适合解决哪些问题。',
    prerequisites: [],
    difficulty: '零基础',
    question: 'Python 解释器在执行源代码时承担什么工作？',
  },
  {
    group: '开发环境与规范',
    id: 'python-install',
    title: '安装 Python 与配置编辑器',
    description: '在 Windows 上完成 Python、VS Code 与扩展配置，并学会检查环境。',
    prerequisites: ['python-intro'],
    difficulty: '零基础',
    question: '为什么终端中 python --version 的结果比安装界面更能证明环境可用？',
  },
  {
    group: 'Python 入门',
    id: 'first-program',
    title: '编写并运行第一个程序',
    description: '创建 .py 文件，理解保存、运行、输出和报错的完整过程。',
    prerequisites: ['python-install'],
    difficulty: '零基础',
    question: '交互式解释器与运行 .py 文件分别适合什么场景？',
  },
  {
    group: '基础语法',
    id: 'syntax-basics',
    title: '注释、缩进与代码块',
    description: '掌握 Python 最重要的书写规则，读懂代码层级和执行范围。',
    prerequisites: ['first-program'],
    difficulty: '零基础',
    question: '为什么 Python 使用缩进而不是大括号表示代码块？',
  },
  {
    group: '基础语法',
    id: 'variables-and-naming',
    title: '变量、赋值与命名',
    description: '理解变量名与对象的关系，养成清晰、稳定的命名习惯。',
    prerequisites: ['syntax-basics'],
    difficulty: '零基础',
    question: '执行 b = a 后再修改 a，为什么 b 不一定随之改变？',
  },
  {
    group: '基础语法',
    id: 'input-output',
    title: '输入与输出',
    description: '使用 print()、input() 和格式化输出完成简单的人机交互。',
    prerequisites: ['variables-and-naming'],
    difficulty: '零基础',
    question: '为什么 input() 得到的内容默认是字符串？',
  },
  {
    group: '数据类型',
    id: 'numbers-booleans-none',
    title: '数字、布尔值与 None',
    description: '认识整数、浮点数、真假值和空值，理解它们的典型用途。',
    prerequisites: ['variables-and-naming'],
    difficulty: '零基础',
    question: 'None、0、False 和空字符串有什么区别？',
  },
  {
    group: '数据类型',
    id: 'strings-basics',
    title: '字符串',
    description: '掌握字符串创建、索引、切片、查找、替换和格式化。',
    prerequisites: ['variables-and-naming'],
    difficulty: '零基础',
    question: '字符串不可变意味着哪些操作会创建新对象？',
  },
  {
    group: '数据类型',
    id: 'type-conversion',
    title: '类型检查与类型转换',
    description: '使用 type()、isinstance() 以及 int()/float()/str() 安全转换数据。',
    prerequisites: ['numbers-booleans-none', 'strings-basics'],
    difficulty: '基础',
    question: '把用户输入转换为数字时，为什么必须考虑转换失败？',
  },
  {
    group: '数据类型',
    id: 'basic-operators',
    title: '运算符与表达式',
    description: '掌握算术、比较、逻辑、成员和赋值运算符。',
    prerequisites: ['numbers-booleans-none'],
    difficulty: '基础',
    question: '为什么复杂表达式应该主动使用括号，而不是依赖运算符优先级？',
  },
  {
    group: '流程控制',
    id: 'control-flow-if',
    title: '条件判断',
    description: '使用 if、elif 和 else 根据条件选择不同的执行路径。',
    prerequisites: ['basic-operators'],
    difficulty: '基础',
    question: '多个独立 if 与 if/elif/else 在执行逻辑上有什么不同？',
  },
  {
    group: '流程控制',
    id: 'loops-for-while',
    title: 'for 与 while 循环',
    description: '重复执行任务，掌握 range()、break、continue 和循环控制。',
    prerequisites: ['control-flow-if'],
    difficulty: '基础',
    question: '什么时候应优先使用 for，什么时候适合使用 while？',
  },
  {
    group: '数据结构',
    id: 'lists',
    title: '列表',
    description: '使用有序、可变的列表保存和处理一组数据。',
    prerequisites: ['loops-for-while'],
    difficulty: '基础',
    question: '列表切片与直接索引返回的数据有什么不同？',
  },
  {
    group: '数据结构',
    id: 'tuples',
    title: '元组',
    description: '理解不可变序列、拆包和多返回值的常见写法。',
    prerequisites: ['lists'],
    difficulty: '基础',
    question: '什么时候元组比列表更能表达数据不会被修改的意图？',
  },
  {
    group: '数据结构',
    id: 'dicts',
    title: '字典',
    description: '使用键值映射组织具有明确名称和关系的数据。',
    prerequisites: ['lists'],
    difficulty: '基础',
    question: '为什么字典的键必须是可哈希对象？',
  },
  {
    group: '数据结构',
    id: 'sets',
    title: '集合',
    description: '使用集合完成去重、成员判断和交并差运算。',
    prerequisites: ['lists'],
    difficulty: '基础',
    question: '集合为什么不适合依赖位置和顺序的数据？',
  },
  {
    group: '函数与模块',
    id: 'functions',
    title: '函数',
    description: '定义可复用代码，理解参数、返回值、作用域和默认参数。',
    prerequisites: ['lists', 'dicts'],
    difficulty: '基础',
    question: '函数的 return 与 print() 有什么根本区别？',
  },
  {
    group: '函数与模块',
    id: 'modules-packages',
    title: '模块、包与导入',
    description: '把代码拆分到多个文件，正确使用 import 和标准库。',
    prerequisites: ['functions'],
    difficulty: '基础',
    question: '为什么不推荐使用 from module import *？',
  },
  {
    group: '文件与异常',
    id: 'file-io',
    title: '文件读写',
    description: '使用 pathlib 和 with 安全读写文本文件，处理路径与编码。',
    prerequisites: ['modules-packages', 'strings-basics'],
    difficulty: '基础',
    question: 'with open() 为什么比手动 open()/close() 更可靠？',
  },
  {
    group: '文件与异常',
    id: 'error-handling',
    title: '错误与异常处理',
    description: '读懂报错信息，使用 try/except 处理可预期异常。',
    prerequisites: ['file-io', 'functions'],
    difficulty: '基础',
    question: '为什么不应该用空的 except 捕获并忽略所有异常？',
  },
];

export const toolsChapterOrder = [
  'Python 入门',
  '基础语法',
  '数据类型',
  '流程控制',
  '数据结构',
  '函数与模块',
  '文件与异常',
  '开发环境与规范',
] as const;

export const toolsKnowledgePoints: ToolsKnowledgePoint[] = seeds.map((seed) => ({
  level: 'low',
  group: seed.group,
  id: seed.id,
  title: seed.title,
  description: seed.description,
  prerequisites: seed.prerequisites,
  difficulty: seed.difficulty,
  tutorialMarkdown: toolsTutorials[seed.id].replaceAll('\\`', '`'),
  practiceStatus: 'collecting',
  core: seed.description,
  formula: '本教程以可运行的 Python 代码为准。',
  engineering: '仿真实践案例将在后续阶段单独补充。',
  pitfall: '只记结论，不亲自运行和修改示例。',
  check: '能够独立运行示例，并解释每一行代码的作用。',
  question: seed.question,
}));
