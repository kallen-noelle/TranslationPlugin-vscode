/**
 * Built-in word list for the "Word of the Day" feature.
 */

/** 按词性分组的释义条目 */
export interface Definition {
  /** 词性标签,如 "名词"、"动词"、"形容词" */
  pos: string;
  /** 该词性下的释义,用分号分隔多个义项 */
  meaning: string;
}

export interface WordItem {
  word: string;
  phonetic?: string;
  /** 简洁翻译(兼容旧渲染) */
  translation: string;
  /** 按词性分组的详细释义 */
  definitions?: Definition[];
  example: string;
  exampleTranslation: string;
}

export const WORD_LIST: WordItem[] = [
  {
    word: 'resilience', phonetic: '/rɪˈzɪliəns/', translation: '韧性;恢复力',
    definitions: [
      { pos: '名词', meaning: '恢复力;韧性;弹性;迅速恢复的能力' },
    ],
    example: 'The system shows remarkable resilience under heavy load.',
    exampleTranslation: '该系统在高负载下表现出非凡的韧性。'
  },
  {
    word: 'concurrency', phonetic: '/kənˈkɜːrənsi/', translation: '并发',
    definitions: [
      { pos: '名词', meaning: '并发;并发度;同时发生;并行处理' },
    ],
    example: 'Concurrency control prevents data races in multi-threaded programs.',
    exampleTranslation: '并发控制防止多线程程序中的数据竞争。'
  },
  {
    word: 'abstraction', phonetic: '/æbˈstrækʃn/', translation: '抽象',
    definitions: [
      { pos: '名词', meaning: '抽象;抽象化;抽象概念;提取' },
    ],
    example: 'Abstraction hides implementation details behind a clean interface.',
    exampleTranslation: '抽象把实现细节隐藏在简洁的接口之后。'
  },
  {
    word: 'idempotent', phonetic: '/ˌaɪdemˈpoʊtənt/', translation: '幂等的',
    definitions: [
      { pos: '形容词', meaning: '幂等的;等幂的;无副作用的' },
    ],
    example: 'A retry of an idempotent request has no additional effect.',
    exampleTranslation: '对幂等请求的重试不会产生额外影响。'
  },
  {
    word: 'latency', phonetic: '/ˈleɪtənsi/', translation: '延迟',
    definitions: [
      { pos: '名词', meaning: '延迟;潜伏;潜伏期;响应时间' },
    ],
    example: 'Reducing network latency improves the user experience.',
    exampleTranslation: '降低网络延迟可以改善用户体验。'
  },
  {
    word: 'throughput', phonetic: '/ˈθruːpʊt/', translation: '吞吐量',
    definitions: [
      { pos: '名词', meaning: '吞吐量;生产率;处理能力;周转量' },
    ],
    example: 'The new cache increases throughput by 40 percent.',
    exampleTranslation: '新的缓存使吞吐量提升了 40%。'
  },
  {
    word: 'robust', phonetic: '/roʊˈbʌst/', translation: '健壮的',
    definitions: [
      { pos: '形容词', meaning: '健壮的;坚固的;耐用的;强有力的' },
    ],
    example: 'A robust parser handles malformed input gracefully.',
    exampleTranslation: '健壮的解析器能优雅地处理畸形输入。'
  },
  {
    word: 'scalable', phonetic: '/ˈskeɪləbl/', translation: '可扩展的',
    definitions: [
      { pos: '形容词', meaning: '可扩展的;可缩放的;可升级的' },
    ],
    example: 'The design must be scalable to millions of users.',
    exampleTranslation: '该设计必须能扩展到数百万用户。'
  },
  {
    word: 'latent', phonetic: '/ˈleɪtnt/', translation: '潜在的;潜伏的',
    definitions: [
      { pos: '形容词', meaning: '潜在的;潜伏的;隐藏的;不易察觉的' },
    ],
    example: 'Latent bugs may only appear under specific conditions.',
    exampleTranslation: '潜在缺陷可能只在特定条件下出现。'
  },
  {
    word: 'redundant', phonetic: '/rɪˈdʌndənt/', translation: '冗余的',
    definitions: [
      { pos: '形容词', meaning: '冗余的;多余的;重复的;过剩的' },
    ],
    example: 'Redundant components keep the service available during failures.',
    exampleTranslation: '冗余组件保证服务在故障期间依然可用。'
  },
  {
    word: 'iterate', phonetic: '/ˈɪtəreɪt/', translation: '迭代',
    definitions: [
      { pos: '动词', meaning: '迭代;重复;反复做;遍历' },
    ],
    example: 'Iterate on the prototype based on user feedback.',
    exampleTranslation: '根据用户反馈迭代原型。'
  },
  {
    word: 'encapsulate', phonetic: '/ɪnˈkæpsjuleɪt/', translation: '封装',
    definitions: [
      { pos: '动词', meaning: '封装;概括;囊括;包入胶囊' },
    ],
    example: 'Encapsulate state and expose it through methods.',
    exampleTranslation: '封装状态,并通过方法对外暴露。'
  },
  {
    word: 'legacy', phonetic: '/ˈleɡəsi/', translation: '遗留的',
    definitions: [
      { pos: '名词', meaning: '遗产;传统;遗留物;遗赠' },
      { pos: '形容词', meaning: '遗留的;旧版的;兼容旧系统的' },
    ],
    example: 'We must keep the legacy system running during migration.',
    exampleTranslation: '迁移期间我们必须保持遗留系统运行。'
  },
  {
    word: 'transient', phonetic: '/ˈtrænziənt/', translation: '瞬态的;短暂的',
    definitions: [
      { pos: '形容词', meaning: '短暂的;瞬态的;临时的;转瞬即逝的' },
      { pos: '名词', meaning: '瞬变现象;过渡;暂住者' },
    ],
    example: 'A transient network error is usually safe to retry.',
    exampleTranslation: '瞬态网络错误通常可以安全重试。'
  },
  {
    word: 'efficiency', phonetic: '/ɪˈfɪʃnsi/', translation: '效率',
    definitions: [
      { pos: '名词', meaning: '效率;效能;功效;提高效率的方法' },
    ],
    example: 'Vectorized operations improve runtime efficiency.',
    exampleTranslation: '向量化操作提高了运行时效率。'
  },
  {
    word: 'consistency', phonetic: '/kənˈsɪstənsi/', translation: '一致性',
    definitions: [
      { pos: '名词', meaning: '一致性;连贯性;持续性;无矛盾' },
    ],
    example: 'Distributed systems trade consistency for availability.',
    exampleTranslation: '分布式系统在一致性与可用性之间取舍。'
  },
  {
    word: 'navigate', phonetic: '/ˈnævɪɡeɪt/', translation: '导航;浏览',
    definitions: [
      { pos: '动词', meaning: '导航;浏览;航行;驾驶;穿行' },
    ],
    example: 'Use the breadcrumb to navigate back to the root.',
    exampleTranslation: '使用面包屑导航回到根目录。'
  },
  {
    word: 'deployment', phonetic: '/dɪˈplɔɪmənt/', translation: '部署',
    definitions: [
      { pos: '名词', meaning: '部署;展开;调度;派遣' },
    ],
    example: 'The deployment pipeline runs automated tests first.',
    exampleTranslation: '部署流水线会先运行自动化测试。'
  },
  {
    word: 'feature', phonetic: '/ˈfiːtʃər/', translation: '功能;特性',
    definitions: [
      { pos: '名词', meaning: '特征;特性;功能;面貌;特写' },
      { pos: '动词', meaning: '以…为特色;主演;特写' },
    ],
    example: 'This release adds a dark mode feature.',
    exampleTranslation: '此版本新增了深色模式功能。'
  },
  {
    word: 'trigger', phonetic: '/ˈtrɪɡər/', translation: '触发',
    definitions: [
      { pos: '名词', meaning: '触发器;扳机;引爆装置' },
      { pos: '动词', meaning: '触发;引起;引发;扣动扳机' },
    ],
    example: 'A build is triggered on every push to main.',
    exampleTranslation: '每次推送到主干都会触发构建。'
  },
  {
    word: 'persistence', phonetic: '/pərˈsɪstəns/', translation: '持久化',
    definitions: [
      { pos: '名词', meaning: '坚持;持久;持久性;持续存在' },
    ],
    example: 'Persistence ensures data survives process restarts.',
    exampleTranslation: '持久化确保数据在进程重启后仍存在。'
  },
  {
    word: 'collaborate', phonetic: '/kəˈlæbəreɪt/', translation: '协作',
    definitions: [
      { pos: '动词', meaning: '协作;合作;勾结;共同开发' },
    ],
    example: 'Teams collaborate on the same codebase via pull requests.',
    exampleTranslation: '团队通过拉取请求在同一代码库上协作。'
  },
  {
    word: 'leverage', phonetic: '/ˈlevərɪdʒ/', translation: '利用',
    definitions: [
      { pos: '名词', meaning: '杠杆;杠杆作用;影响力;优势' },
      { pos: '动词', meaning: '利用;推动;以杠杆方式撬动' },
    ],
    example: 'Leverage existing libraries to speed up development.',
    exampleTranslation: '利用现有库来加快开发。'
  },
  {
    word: 'verify', phonetic: '/ˈverɪfaɪ/', translation: '验证',
    definitions: [
      { pos: '动词', meaning: '验证;核实;证明;校验' },
    ],
    example: 'Verify the checksum before installing the package.',
    exampleTranslation: '安装包之前先验证校验和。'
  },
  {
    word: 'optimize', phonetic: '/ˈɑːptɪmaɪz/', translation: '优化',
    definitions: [
      { pos: '动词', meaning: '优化;使最优化;优选' },
    ],
    example: 'Optimize the hot path to reduce response time.',
    exampleTranslation: '优化热路径以减少响应时间。'
  },
  {
    word: 'ambiguity', phonetic: '/ˌæmbɪˈɡjuːəti/', translation: '歧义',
    definitions: [
      { pos: '名词', meaning: '歧义;含糊;模糊;不明确' },
    ],
    example: 'Type annotations remove ambiguity from the interface.',
    exampleTranslation: '类型注解消除了接口中的歧义。'
  },
  {
    word: 'graceful', phonetic: '/ˈɡreɪsfl/', translation: '优雅的',
    definitions: [
      { pos: '形容词', meaning: '优雅的;体面的;得体的;和蔼的' },
    ],
    example: 'The app shuts down gracefully to avoid data loss.',
    exampleTranslation: '应用优雅关闭以避免数据丢失。'
  },
  {
    word: 'buffer', phonetic: '/ˈbʌfər/', translation: '缓冲',
    definitions: [
      { pos: '名词', meaning: '缓冲;缓冲区;减震器;缓冲剂' },
      { pos: '动词', meaning: '缓冲;减轻;保护;缓存' },
    ],
    example: 'A buffer smooths out bursts of incoming data.',
    exampleTranslation: '缓冲区平滑了突发的输入数据。'
  },
  {
    word: 'immutable', phonetic: '/ɪˈmjuːtəbl/', translation: '不可变的',
    definitions: [
      { pos: '形容词', meaning: '不可变的;不可改变的;永恒的' },
    ],
    example: 'Immutable objects are safe to share between threads.',
    exampleTranslation: '不可变对象可以安全地在线程间共享。'
  },
  {
    word: 'concurrent', phonetic: '/kənˈkɜːrənt/', translation: '并发的',
    definitions: [
      { pos: '形容词', meaning: '并发的;同时发生的;并行的' },
      { pos: '名词', meaning: '并发事件;同时发生的事情' },
    ],
    example: 'Concurrent tasks run in overlapping time periods.',
    exampleTranslation: '并发任务在重叠的时间段内运行。'
  },
];
