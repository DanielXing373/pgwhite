/* Imported by pages/ac1test.vue: must stay free of source ids and server-only data. */

/**
 * Participant copy `ac1-hs-copy.v1`, adapted from `el2-hs-copy.v4`. Consent bullets, acknowledgement,
 * buttons, confirmation and thank-you text are unchanged from v4 except that 「主题标签评估」 became
 * 「标签评估」; the description, page instructions and validation text describe ticking tags.
 */
export const COPY = {
  version: 'ac1-hs-copy.v1',
  welcome: '欢迎参加鸽白词句库的阅读研究',
  research_description: [
    '本研究希望了解读者认为哪些标签适合一段文字。',
    '您将阅读 10 段文字，每段下面有若干标签，分为主题、修辞、描写手法三类。请勾选您认为合适的标签，可以多选；如果都不合适，也可以选择「都不合适」。',
    '整个过程预计需要 8–12 分钟。'
  ],
  consent_bullets: [
    '本问卷面向年满 18 周岁的读者，参与完全自愿，可随时退出。',
    '无需提供姓名或账号，回答将以匿名编号保存。',
    '回答仅用于标签评估、系统改进及汇总结果展示，不公开个人作答记录。',
    '问卷会自动保存进度，关闭页面不会立即删除已保存的回答。'
  ],
  consent_ack: '点击「同意并开始」，表示您已阅读以上说明，并自愿参与。',
  loading: '正在加载问卷，首次打开可能需要几秒钟…',
  start: '同意并开始',
  decline: '不同意，离开',
  first_section:
    '下面有 5 段文学摘录。请凭个人理解，勾选您认为合适的标签，可以多选。如果都不合适，请选「都不合适」。',
  second_section_control:
    '下面有新的 5 段文学摘录。请凭个人理解，勾选您认为合适的标签，可以多选。如果都不合适，请选「都不合适」。',
  second_section_disclosure:
    '下面有新的 5 段文学摘录。请凭个人理解，勾选您认为合适的标签，可以多选。如果都不合适，请选「都不合适」。',
  disclosure_notice: '请注意，本页包含 AI 生成的标签。',
  none_of_the_above: '都不合适',
  multi_label: '（多选）',
  validation_incomplete: '还有摘录没有作答（每段必答）。请至少勾选一个合适的标签；如果都不合适，请选「都不合适」。',
  validation_scroll: '已帮您定位到第一处。',
  question_hint: '本段必答：请至少勾选一个标签，或选「都不合适」。',
  submit_incomplete: '请先完成全部 10 段摘录：每段至少勾选一个标签，或选「都不合适」。',
  submit_confirm: '提交后将无法修改。确认提交吗？',
  submit_yes: '确认提交',
  submit_back: '返回检查',
  thank_you: '感谢您的参与。回答已匿名保存。可以关闭此页面。',
  continue: '继续',
  back: '上一页',
  progress_1: '第 1–5 段，共 10 段',
  progress_2: '第 6–10 段，共 10 段',
  answered_prefix: '已答',
  test_banner: '测试模式：回答不计入正式分析。',
  already_submitted: '这份问卷已经提交，不能再修改。',
  rate_limited: '开始的次数过于频繁，请稍后再试。',
  mode_disabled: '当前环境未开放此问卷。',
  start_failed: '暂时无法开始，请稍后再试。',
  submit_failed: '提交失败，请稍后再试。'
} as const
