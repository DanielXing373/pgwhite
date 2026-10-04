#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PGWhite 1.41 — build Atomic Tag Library research artifacts (offline, deterministic)."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
DATA = ROOT / "data"
NOW = "2026-10-04T20:00:00.000Z"
LIBRARY_VERSION = "atomic-tag-library.v1.41"


def dump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def slug_id(prefix: str, zh: str, n: int) -> str:
    return f"{prefix}-{n:04d}-{zh}"


def rep_a(label: str) -> str:
    return label.strip()


def rep_b(label: str, definition: str) -> str:
    return f"{label.strip()}：{(definition or '').strip()}"


def rep_c(label: str, definition: str, aliases: list[str]) -> str:
    cleaned = sorted({a.strip() for a in aliases if a and a.strip() and a.strip() != label.strip()})
    alias_part = "、".join(cleaned)
    base = rep_b(label, definition)
    if alias_part:
        return f"{base}｜别名：{alias_part}"
    return f"{base}｜别名：（无）"


def collect_free_concepts() -> tuple[Counter, Counter]:
    themes: Counter = Counter()
    devices: Counter = Counter()
    runs = [
        "atomic-v1.2-calib-12",
        "atomic-v1.2-calib-12-nano",
        "smoke-free-concepts-v1.2",
        "smoke-free-concepts-v1.1",
    ]
    for run in runs:
        path = REPO / "research/annotation-workbench/runs" / run / "free-concepts.json"
        if not path.exists():
            continue
        data = load_json(path)
        for item in data.get("results") or []:
            stack: list = [item]
            while stack:
                obj = stack.pop()
                if isinstance(obj, dict):
                    for key, bucket in (("themes", themes), ("devices", devices)):
                        vals = obj.get(key)
                        if (
                            isinstance(vals, list)
                            and vals
                            and isinstance(vals[0], (str, dict))
                        ):
                            for x in vals:
                                if isinstance(x, str):
                                    lab = x
                                else:
                                    lab = x.get("label") or x.get("zh") or x.get("concept")
                                if lab:
                                    bucket[lab] += 1
                    for v in obj.values():
                        if isinstance(v, (dict, list)):
                            stack.append(v)
                elif isinstance(obj, list):
                    for v in obj:
                        if isinstance(v, (dict, list)):
                            stack.append(v)
    return themes, devices


def theme(
    zh: str,
    en: str,
    definition: str,
    *,
    aliases: list[str] | None = None,
    related: list[str] | None = None,
    parents: list[str] | None = None,
    category: str = "未分类",
    provenance: list[str],
    source_refs: list[str] | None = None,
    status: str = "active_candidate",
    notes: str = "",
    lto_names: list[str] | None = None,
) -> dict:
    refs = list(source_refs or [])
    for name in lto_names or []:
        refs.append(f"lto:theme:{name}")
    return {
        "zh": zh,
        "en": en,
        "dimension": "theme",
        "definition": definition,
        "aliases": aliases or [],
        "related": related or [],
        "parents": parents or ([category] if category else []),
        "category": category,
        "provenance": sorted(set(provenance)),
        "source_refs": sorted(set(refs)),
        "status": status,
        "notes": notes,
    }


def device(
    zh: str,
    en: str,
    definition: str,
    *,
    aliases: list[str] | None = None,
    related: list[str] | None = None,
    provenance: list[str],
    source_refs: list[str] | None = None,
    status: str = "active_candidate",
    notes: str = "",
) -> dict:
    return {
        "zh": zh,
        "en": en,
        "dimension": "device",
        "definition": definition,
        "aliases": aliases or [],
        "related": related or [],
        "parents": ["修辞与表现手法"],
        "category": "修辞与表现手法",
        "provenance": sorted(set(provenance)),
        "source_refs": sorted(set(source_refs or [])),
        "status": status,
        "notes": notes,
    }


def build_theme_seeds() -> list[dict]:
    """Curated Theme candidates (~200). Empty tags allowed. Generated candidates are suggestions."""
    T = []

    def add(**kwargs):
        T.append(theme(**kwargs))

    # --- existing PGWhite (keep 时间 as research-excluded) ---
    add(
        zh="时间",
        en="Time",
        definition="时间流逝、时序感知与时间意识；因与 Scene/Time 维度冲突，研究库保留但不作为活跃 Theme。",
        aliases=["时光"],
        related=["记忆", "衰老", "怀旧", "命运"],
        category="存在",
        provenance=["existing_pgwhite", "legacy_human"],
        source_refs=["pgwhite:tag:6"],
        status="excluded_scene_time_conflict",
        notes="Present in production Theme taxonomy but excluded from active 1.4/1.41 Theme reconcile targets.",
    )
    add(zh="痛苦", en="Suffering", definition="身体或精神上的受苦、伤痛与难耐体验。", aliases=["苦痛", "苦难"], related=["悲伤", "疾病", "创伤", "绝望"], category="情感", provenance=["existing_pgwhite", "legacy_human"], source_refs=["pgwhite:tag:7"])
    add(zh="寂静", en="Silence", definition="安静、无声或声音退后的氛围与内心状态。", aliases=["沉默", "静默"], related=["孤独", "倾听", "压抑"], category="感知", provenance=["existing_pgwhite", "legacy_human"], source_refs=["pgwhite:tag:8"])
    add(zh="记忆", en="Memory", definition="记住、回想与被过去经验塑造的心智领地，可涵盖回忆唤起、保存与改变。", aliases=["回忆"], related=["遗忘", "童年", "怀旧", "身份"], category="心智", provenance=["existing_pgwhite", "legacy_human", "annotation_benchmark", "literary_theme_ontology"], source_refs=["pgwhite:tag:9"], lto_names=["the nature of memory"])
    add(zh="焦虑", en="Anxiety", definition="担忧、紧张与不安的持续性心理压力。", aliases=["不安", "忧虑"], related=["恐惧", "控制", "未来"], category="情感", provenance=["existing_pgwhite", "legacy_human", "annotation_benchmark"], source_refs=["pgwhite:tag:10"], lto_names=["acute anxiety"])
    add(zh="衰败", en="Decay", definition="事物、身体、关系或秩序走向破损、腐朽与没落。", aliases=["凋敝", "没落"], related=["衰老", "死亡", "废墟", "时间流逝"], category="存在", provenance=["existing_pgwhite", "legacy_human", "annotation_benchmark"], source_refs=["pgwhite:tag:11"])
    add(zh="掌控", en="Control", definition="试图支配局面、他人或自我冲动的力量感与控制欲。", aliases=["控制"], related=["权力", "自由", "压迫", "冲动"], category="权力关系", provenance=["existing_pgwhite", "legacy_human", "annotation_benchmark", "literary_theme_ontology"], source_refs=["pgwhite:tag:12"], lto_names=["exercising self-control", "controlling partner"])
    add(zh="死亡", en="Death", definition="生命终结、死亡意识，以及围绕死亡的恐惧、接受或反思。", aliases=["过世"], related=["失去", "悲伤", "恐惧", "生命"], category="存在", provenance=["existing_pgwhite", "legacy_human", "literary_theme_ontology"], source_refs=["pgwhite:tag:13"], lto_names=["the nature of death", "facing death", "fear of death", "coping with mortality"])
    add(zh="命运", en="Fate", definition="命定、不可控力量或轨迹感如何塑造人生。", aliases=["宿命", "天命"], related=["自由", "掌控", "偶然", "意义"], category="存在", provenance=["existing_pgwhite", "legacy_human", "literary_theme_ontology"], source_refs=["pgwhite:tag:14"], lto_names=["destiny"])
    add(zh="敏感", en="Sensitivity", definition="对外界刺激或他人情绪过分敏锐、易受触动。", aliases=["纤敏"], related=["脆弱", "感知", "焦虑"], category="感知", provenance=["existing_pgwhite", "legacy_human"], source_refs=["pgwhite:tag:15"])
    add(zh="末日", en="Apocalypse", definition="世界或既有秩序走向终结的想象与危机感。", aliases=["末世"], related=["死亡", "灾难", "衰败", "恐惧"], category="存在", provenance=["existing_pgwhite", "legacy_human"], source_refs=["pgwhite:tag:16"])
    add(zh="厌恶", en="Disgust", definition="反感、嫌恶与排斥的情感反应。", aliases=["反感", "嫌恶"], related=["仇恨", "羞耻", "身体"], category="情感", provenance=["existing_pgwhite", "legacy_human", "annotation_benchmark"], source_refs=["pgwhite:tag:17"])
    add(zh="轮回", en="Cycle", definition="循环往复、重复发生或生死流转的模式感。", aliases=["循环"], related=["命运", "重复", "时间流逝", "重生"], category="存在", provenance=["existing_pgwhite", "legacy_human"], source_refs=["pgwhite:tag:18"])

    # --- core generated + multi-source literary Themes ---
    core = [
        # emotions
        ("悲伤", "Sadness", "哀伤、难过与情绪低落的基本情感领地。", ["伤心", "难过", "哀伤"], ["失去", "遗憾", "孤独", "死亡"], "情感", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["grief"]),
        ("喜悦", "Joy", "愉快、高兴与欢欣的正向情感。", ["快乐", "欢喜"], ["希望", "爱", "满足"], "情感", ["generated_candidate"], []),
        ("恐惧", "Fear", "对危险、未知或伤害的害怕与惊惧。", ["害怕", "惊惧"], ["死亡", "焦虑", "暴力", "勇气"], "情感", ["generated_candidate", "literary_theme_ontology"], ["fear", "the nature of fear", "fear of death"]),
        ("愤怒", "Anger", "被冒犯、受阻或受伤害时的怒意。", ["怒火", "恼怒"], ["暴力", "仇恨", "报复", "公正"], "情感", ["generated_candidate", "literary_theme_ontology"], ["anger"]),
        ("羞愧", "Shame", "自觉丢脸或未达自我标准时的羞耻感。", ["羞耻", "耻辱"], ["内疚", "屈辱", "虚伪"], "情感", ["generated_candidate", "literary_theme_ontology"], ["shame"]),
        ("内疚", "Guilt", "觉得做错事或亏欠他人时的自责。", ["愧疚", "自责"], ["羞愧", "遗憾", "救赎"], "情感", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["survivor guilt"]),
        ("希望", "Hope", "对更好可能的期待与信心。", ["盼望"], ["绝望", "命运", "意义"], "情感", ["generated_candidate", "literary_theme_ontology"], ["hope"]),
        ("绝望", "Despair", "感到无路可走、失去盼望的沉重心境。", ["无望"], ["希望", "死亡", "虚无"], "情感", ["generated_candidate"], []),
        ("孤独", "Loneliness", "缺乏联结、被隔绝或无人理解的感受。", ["寂寞", "孤单"], ["疏离", "归属", "友情", "爱情"], "情感", ["generated_candidate", "literary_theme_ontology"], ["loneliness"]),
        ("嫉妒", "Jealousy", "担心失去所爱，或因他人拥有而不平衡。", ["妒忌"], ["爱情", "占有", "背叛", "自卑"], "情感", ["generated_candidate", "literary_theme_ontology"], ["jealousy", "romantic jealousy"]),
        ("仇恨", "Hatred", "强烈而持久的敌意与憎恶。", ["憎恨", "恨意"], ["愤怒", "暴力", "报复", "宽恕"], "情感", ["generated_candidate", "literary_theme_ontology"], ["hate begets hate"]),
        ("怜悯", "Compassion", "对他人苦难的同情与愿减轻痛苦的倾向。", ["同情", "慈悲"], ["残酷", "暴力", "救赎"], "情感", ["generated_candidate", "literary_theme_ontology"], ["compassion", "mercy"]),
        ("温柔", "Tenderness", "柔和、体贴与小心对待他者的情感质地。", ["柔情"], ["爱", "体谅", "脆弱"], "情感", ["generated_candidate"], []),
        ("冷漠", "Apathy", "缺乏关心、情感抽离或不愿投入。", ["淡漠", "无动于衷"], ["疏离", "孤独", "压抑"], "情感", ["generated_candidate"], []),
        ("无聊", "Boredom", "缺乏刺激或意义时的空虚与倦怠感。", ["乏味"], ["倦怠", "重复", "日常"], "情感", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["boredom"]),
        ("敬畏", "Awe", "面对巨大、崇高或神秘事物时的震慑与崇敬。", ["畏敬"], ["信仰", "自然", "美"], "情感", ["generated_candidate", "literary_theme_ontology"], ["awe"]),
        ("屈辱", "Humiliation", "被贬低、践踏尊严时的难堪与痛感。", ["受辱"], ["羞愧", "压迫", "权力"], "情感", ["annotation_benchmark", "generated_candidate"], []),
        ("压抑", "Repression", "情感、欲望或表达被压制而不能释放。", ["压制感"], ["焦虑", "欲望", "自由"], "情感", ["annotation_benchmark", "generated_candidate"], []),
        ("倦怠", "Burnout", "长期消耗后的身心疲惫与提不起劲。", ["疲惫", "倦意"], ["无聊", "工作", "绝望"], "情感", ["annotation_benchmark", "generated_candidate"], []),
        ("满足", "Contentment", "感到足够、安稳或心意落地的状态。", ["知足"], ["喜悦", "平静", "家园"], "情感", ["generated_candidate"], []),
        ("平静", "Calm", "情绪安稳、内心少波动的状态。", ["安宁", "平和"], ["寂静", "希望", "接受"], "情感", ["generated_candidate"], []),
        ("冲动", "Impulse", "未经充分克制的突然行动倾向。", ["莽撞"], ["欲望", "掌控", "后悔"], "情感", ["annotation_benchmark", "generated_candidate"], []),
        ("好奇", "Curiosity", "想知道、探索与追问的驱力。", ["好奇心"], ["求知", "旅行", "秘密"], "情感", ["annotation_benchmark", "generated_candidate"], []),
        ("自卑", "Inferiority", "觉得自己不如他人、不够好的自我评价。", ["低人一等"], ["嫉妒", "羞耻", "身份"], "情感", ["generated_candidate"], []),
        ("骄傲", "Pride", "自我肯定、尊严感或过分自矜。", ["自豪", "傲慢"], ["身份", "羞愧", "权力"], "情感", ["generated_candidate", "literary_theme_ontology"], ["pride"]),
        ("遗憾", "Regret", "对未能实现、未能挽回之事的怅恨。", ["悔恨", "惋惜"], ["失去", "记忆", "选择"], "情感", ["annotation_benchmark", "generated_candidate"], []),
        ("思念", "Longing", "对不在场之人、之地或之时的牵挂与渴念。", ["想念", "牵挂"], ["爱", "怀旧", "分离"], "情感", ["generated_candidate"], []),
        ("迷恋", "Obsession", "过度专注、难以放下的执念。", ["执念", "痴迷"], ["欲望", "爱情", "控制"], "情感", ["generated_candidate", "literary_theme_ontology"], ["obsession", "obsessive love"]),
        ("安慰", "Comfort", "被抚慰或寻求慰藉的情感需求。", ["慰藉"], ["悲伤", "体谅", "家园"], "情感", ["generated_candidate"], []),
        ("体谅", "Understanding", "体察他人处境并予以包容理解。", ["谅解", "体贴"], ["怜悯", "爱", "宽恕"], "情感", ["annotation_benchmark", "generated_candidate"], []),
        # relations
        ("爱", "Love", "广义的爱与被爱，涵盖亲密、依恋与深切关怀。", ["热爱"], ["亲情", "爱情", "友情", "依恋"], "情感与关系", ["generated_candidate", "literary_theme_ontology"], ["love", "the nature of love"]),
        ("爱情", "Romantic Love", "浪漫或情爱关系中的吸引、依恋与情感纠葛。", ["恋情", "浪漫"], ["爱", "欲望", "嫉妒", "背叛"], "情感与关系", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["romantic love", "tragic love"]),
        ("亲情", "Familial Affection", "家庭成员之间的情感联结与牵挂。", ["骨肉之情"], ["父亲", "母亲", "孩子", "爱", "失去"], "情感与关系", ["generated_candidate", "literary_theme_ontology"], ["filial love", "parental love"]),
        ("友情", "Friendship", "非血缘、非情爱的友伴关系与互助信任。", ["友谊"], ["信任", "背叛", "忠诚", "孤独"], "情感与关系", ["generated_candidate", "literary_theme_ontology"], ["friendship", "love vs. friendship"]),
        ("依恋", "Attachment", "强烈依赖与不愿分离的情感纽带。", ["依赖"], ["爱", "分离", "恐惧"], "情感与关系", ["generated_candidate"], []),
        ("分离", "Separation", "离开、拆散或关系中断的处境。", ["离别", "分手"], ["团聚", "思念", "失去", "旅行"], "情感与关系", ["annotation_benchmark", "generated_candidate"], []),
        ("团聚", "Reunion", "重逢、回归与关系恢复。", ["重逢", "归来"], ["分离", "家园", "亲情"], "情感与关系", ["annotation_benchmark", "generated_candidate"], []),
        ("背叛", "Betrayal", "信任被出卖或承诺被违背。", ["背弃"], ["信任", "友情", "爱情", "仇恨"], "情感与关系", ["generated_candidate", "literary_theme_ontology"], ["betrayal"]),
        ("信任", "Trust", "信赖他人或被他人视为可靠。", ["信赖"], ["背叛", "友情", "诚实"], "情感与关系", ["generated_candidate", "literary_theme_ontology"], ["honesty", "friendship"]),
        ("忠诚", "Loyalty", "对人或价值保持忠贞不渝。", ["忠贞"], ["背叛", "友情", "信仰"], "情感与关系", ["generated_candidate"], []),
        ("父亲", "Father", "父职、父亲形象及其情感/权力关系（高复用关系概念）。", ["爸爸", "父"], ["母亲", "孩子", "亲情"], "关系角色", ["generated_candidate", "literary_theme_ontology"], ["father and son", "father and daughter", "single fatherhood"]),
        ("母亲", "Mother", "母职、母亲形象及其情感/养育关系（高复用关系概念）。", ["妈妈", "母"], ["父亲", "孩子", "亲情"], "关系角色", ["generated_candidate", "literary_theme_ontology"], ["mother and son", "mother and daughter", "single motherhood"]),
        ("孩子", "Child", "作为子女或孩童的处境、视角与被养育关系。", ["小孩", "子女"], ["父亲", "母亲", "童年", "亲情"], "关系角色", ["generated_candidate", "literary_theme_ontology"], ["human childhood", "human parenting"]),
        ("婚姻", "Marriage", "婚姻制度与夫妻关系中的联结、张力与变故。", ["结婚"], ["爱情", "家庭", "背叛", "责任"], "情感与关系", ["generated_candidate", "literary_theme_ontology"], ["arranged marriage", "mixed marriage", "coping with a failing marriage"]),
        ("家庭", "Family", "家庭作为情感、责任与冲突的单位。", ["家人"], ["亲情", "父亲", "母亲", "秘密"], "情感与关系", ["generated_candidate", "literary_theme_ontology"], ["family dispute", "family honor", "dark family secret"]),
        ("占有", "Possessiveness", "想把人或物据为己有的控制倾向。", ["独占"], ["嫉妒", "爱情", "掌控"], "情感与关系", ["generated_candidate"], []),
        # existence / life
        ("生命", "Life", "活着本身、生命力与生存境况。", ["存活"], ["死亡", "身体", "意义"], "存在", ["generated_candidate", "literary_theme_ontology"], ["the wish to live", "what life is like"]),
        ("失去", "Loss", "无可挽回地丧失人或重要之物/状态。", ["丧失", "失落"], ["悲伤", "死亡", "记忆", "遗憾"], "存在", ["annotation_benchmark", "generated_candidate"], []),
        ("重生", "Rebirth", "经历崩解后的更新、再出发或再生想象。", ["再生", "新生"], ["死亡", "救赎", "轮回"], "存在", ["generated_candidate"], []),
        ("虚无", "Nothingness", "意义空缺、空洞与存在无根基感。", ["空虚", "虚无感"], ["绝望", "意义", "孤独"], "存在", ["annotation_benchmark", "generated_candidate"], []),
        ("意义", "Meaning", "人生、事件或行动是否值得、指向什么。", ["价值", "意义感"], ["虚无", "信仰", "选择"], "存在", ["generated_candidate"], []),
        ("自由", "Freedom", "免于束缚、能够自主选择与行动。", ["自主"], ["权力", "压迫", "命运", "掌控"], "存在", ["generated_candidate", "literary_theme_ontology"], ["the need for freedom", "order vs. freedom", "security vs. freedom"]),
        ("偶然", "Chance", "无明确意图的巧合、机运与不确定。", ["巧合", "运气"], ["命运", "选择"], "存在", ["generated_candidate"], []),
        ("选择", "Choice", "在可能性之间做出取舍及其后果。", ["抉择"], ["自由", "责任", "遗憾"], "存在", ["generated_candidate"], []),
        ("责任", "Responsibility", "对他人、角色或后果应承担的义务感。", ["担当"], ["内疚", "家庭", "牺牲"], "存在", ["generated_candidate"], []),
        ("接受", "Acceptance", "承认现实并不再无谓抗拒。", ["接纳"], ["平静", "失去", "命运"], "存在", ["generated_candidate"], []),
        ("变化", "Change", "状态、关系或自我发生转变。", ["变迁", "转变"], ["成长", "失去", "适应"], "存在", ["generated_candidate"], []),
        ("重复", "Repetition", "同样模式一再发生的体验。", ["一再"], ["轮回", "日常", "无聊"], "存在", ["generated_candidate"], []),
        ("日常", "Everyday Life", "平凡反复的生活肌理与琐碎现实。", ["平淡"], ["工作", "家庭", "无聊"], "存在", ["generated_candidate"], []),
        ("秘密", "Secret", "被隐藏的信息、过去或欲望。", ["隐秘"], ["真相", "羞耻", "家庭"], "存在", ["generated_candidate", "literary_theme_ontology"], ["dark family secret"]),
        ("幻灭", "Disillusionment", "理想或信念破灭后的清醒与失落。", ["失望"], ["希望", "真相", "成长"], "存在", ["generated_candidate"], []),
        ("纯真", "Innocence", "未受污染的天真、无知或道德清白。", ["天真"], ["童年", "腐败", "成长"], "存在", ["generated_candidate"], []),
        ("脆弱", "Vulnerability", "易受伤害、需要被保护的状态。", ["易碎"], ["敏感", "身体", "爱"], "存在", ["annotation_benchmark", "generated_candidate"], []),
        ("珍视", "Cherishing", "对人或物的宝贵感与舍不得失去。", ["珍惜"], ["失去", "爱", "记忆"], "存在", ["annotation_benchmark", "generated_candidate"], []),
        # self / mind
        ("身份", "Identity", "关于“我是谁”的自我与社会定位。", ["自我认同", "身份认同"], ["归属", "疏离", "性别", "记忆"], "自我", ["generated_candidate", "literary_theme_ontology"], ["personal identity", "gender identity"]),
        ("自我", "Self", "自我意识、自我观察与自我关系。", ["自身"], ["身份", "孤独", "欲望"], "自我", ["annotation_benchmark", "generated_candidate"], []),
        ("疏离", "Alienation", "与他人、社会或自我格格不入。", ["异化", "隔阂"], ["孤独", "归属", "压迫", "身份"], "自我", ["annotation_benchmark", "generated_candidate"], []),
        ("归属", "Belonging", "感到被接纳、有位置、与群体或地方相连。", ["归属感"], ["家园", "疏离", "身份", "亲情"], "自我", ["generated_candidate", "literary_theme_ontology"], ["belonging"]),
        ("潜意识", "Unconscious", "未被清晰觉察却影响行为的心理层面。", ["无意识"], ["梦", "欲望", "记忆"], "心智", ["generated_candidate", "literary_theme_ontology"], ["the nature of the subconscious"]),
        ("梦", "Dream", "梦境、愿望投射与潜意识显现。", ["梦境"], ["潜意识", "希望", "幻灭"], "心智", ["generated_candidate", "literary_theme_ontology"], ["human dreaming", "lucid dreaming"]),
        ("幻觉", "Illusion", "不实的感知或被误认的真实。", ["幻象"], ["真相", "疯狂", "梦"], "心智", ["generated_candidate"], []),
        ("理智", "Reason", "冷静分析、克制情感的认知力量。", ["理性"], ["疯狂", "情感", "控制"], "心智", ["generated_candidate", "literary_theme_ontology"], ["rationality vs. emotionality"]),
        ("疯狂", "Madness", "理智失控或被视为失常的状态。", ["疯癫"], ["理智", "恐惧", "暴力"], "心智", ["generated_candidate", "literary_theme_ontology"], ["descent into madness"]),
        ("遗忘", "Forgetting", "记不起、被抹去或主动放下过去。", ["失忆"], ["记忆", "失去", "衰老"], "心智", ["generated_candidate", "literary_theme_ontology"], ["the nature of memory"]),
        ("怀旧", "Nostalgia", "对往昔的感伤回望与情感召回。", ["思旧"], ["记忆", "童年", "青春", "遗憾"], "心智", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["nostalgia", "reminiscence about one's youth"]),
        ("经验", "Experience", "经事后沉淀的阅历与体会。", ["阅历"], ["记忆", "成长", "智慧"], "心智", ["annotation_benchmark", "generated_candidate"], []),
        ("智慧", "Wisdom", "深刻洞见与妥善判断的智性品质。", ["睿智"], ["经验", "真相", "衰老"], "心智", ["generated_candidate"], []),
        ("意志", "Will", "坚持意向、推动行动的内在力量。", ["毅力"], ["欲望", "自由", "掌控"], "心智", ["generated_candidate"], []),
        ("欲望", "Desire", "强烈的想望、渴求与被吸引。", ["渴求", "欲求"], ["爱情", "权力", "冲动"], "心智", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["desire", "mimetic desire"]),
        ("身体", "Body", "肉身感知、外貌与身体处境。", ["肉身"], ["欲望", "疾病", "死亡", "自我"], "身心", ["annotation_benchmark", "generated_candidate"], []),
        ("灵魂", "Soul", "内在精神本质或超越肉身的自我想象。", ["心灵"], ["身体", "信仰", "死亡", "意义"], "身心", ["generated_candidate", "literary_theme_ontology"], ["the soul"]),
        ("性别", "Gender", "性别角色、认同与社会期待。", ["性属"], ["身份", "身体", "权力"], "身心", ["generated_candidate", "literary_theme_ontology"], ["gender identity", "sexism in society"]),
        ("性", "Sexuality", "性欲、性关系与性的社会意义。", ["性欲"], ["欲望", "身体", "爱情", "权力"], "身心", ["generated_candidate", "literary_theme_ontology"], ["human sexuality"]),
        # life stages / places
        ("童年", "Childhood", "儿童时期的经验、感知与回忆。", ["幼年"], ["记忆", "成长", "纯真", "父亲", "母亲"], "人生阶段", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["human childhood", "childhood trauma"]),
        ("青春", "Youth", "青年阶段的热情、躁动与形成期。", ["少年"], ["成长", "欲望", "反叛"], "人生阶段", ["generated_candidate", "literary_theme_ontology"], ["youth rebellion", "reminiscence about one's youth"]),
        ("成长", "Coming of Age", "从稚嫩走向成熟的变化与觉醒。", ["成熟"], ["童年", "青春", "身份", "经验"], "人生阶段", ["generated_candidate"], []),
        ("衰老", "Aging", "变老、机能衰退与老年处境。", ["变老", "老去"], ["衰败", "死亡", "记忆"], "人生阶段", ["generated_candidate", "literary_theme_ontology"], ["coping with aging"]),
        ("家园", "Home", "家、故土或情感安放之所。", ["故乡", "家乡"], ["流亡", "归属", "怀旧", "离开"], "空间情感", ["generated_candidate", "literary_theme_ontology"], ["homesickness"]),
        ("流亡", "Exile", "离开原属之地/群体后的放逐状态。", ["放逐", "流离"], ["家园", "归属", "旅行", "孤独"], "空间情感", ["generated_candidate", "literary_theme_ontology"], ["exile"]),
        ("旅行", "Journey", "在路上的移动、寻找与通过仪式。", ["旅程", "上路"], ["家园", "寻找", "成长"], "空间情感", ["annotation_benchmark", "generated_candidate"], []),
        ("离开", "Departure", "启程、出走或告别原处。", ["出走"], ["分离", "旅行", "自由"], "空间情感", ["annotation_benchmark", "generated_candidate"], []),
        ("寻找", "Quest", "寻找某人或某种意义/真相的过程。", ["追寻"], ["旅行", "意义", "失落"], "空间情感", ["annotation_benchmark", "generated_candidate"], []),
        ("城市", "City", "都市生活、密度与匿名性。", ["都市"], ["疏离", "工作", "现代性"], "空间社会", ["generated_candidate"], []),
        ("自然", "Nature", "自然界及其与人的关系。", ["大自然"], ["衰败", "家园", "生命", "敬畏"], "世界", ["generated_candidate", "literary_theme_ontology"], ["human vs. nature", "pleasure in nature"]),
        ("废墟", "Ruin", "毁坏后的残存空间与历史痕迹。", ["残骸"], ["衰败", "战争", "记忆"], "世界", ["generated_candidate"], []),
        ("灾难", "Disaster", "突发的大规模破坏与危机。", ["灾祸"], ["末日", "恐惧", "死亡"], "世界", ["annotation_benchmark", "generated_candidate"], []),
        # society / moral
        ("权力", "Power", "支配他人或资源的力量及其效应。", ["权势"], ["掌控", "压迫", "腐败", "自由"], "社会", ["generated_candidate", "literary_theme_ontology"], ["power corrupts"]),
        ("压迫", "Oppression", "系统性压制、剥夺自由或尊严。", ["压制"], ["权力", "自由", "反抗", "屈辱"], "社会", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["social oppression"]),
        ("反抗", "Resistance", "对压迫或不公的拒斥与斗争。", ["抗争"], ["压迫", "自由", "勇气"], "社会", ["generated_candidate"], []),
        ("暴力", "Violence", "对他者施加伤害的强制与破坏。", [], ["压迫", "恐惧", "权力", "死亡"], "社会", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["the instinct for violence", "domestic violence"]),
        ("战争", "War", "武装冲突及其伦理与创伤。", ["战乱"], ["暴力", "死亡", "和平", "恐惧"], "社会", ["generated_candidate", "literary_theme_ontology"], ["war", "civil war", "war crime"]),
        ("和平", "Peace", "无战状态或内心/社会的安宁秩序。", ["太平"], ["战争", "平静", "希望"], "社会", ["generated_candidate", "literary_theme_ontology"], ["peace on Earth"]),
        ("公正", "Justice", "公平、正义诉求与奖惩是否得当。", ["正义"], ["报复", "宽恕", "罪"], "道德社会", ["generated_candidate", "literary_theme_ontology"], ["what is justice", "poetic justice", "mercy vs. justice"]),
        ("报复", "Revenge", "以伤害回应伤害的报复冲动或行动。", ["复仇"], ["仇恨", "公正", "暴力"], "道德社会", ["generated_candidate"], []),
        ("宽恕", "Forgiveness", "放下怨恨、原谅或寻求被原谅。", ["原谅"], ["内疚", "救赎", "仇恨", "怜悯"], "道德社会", ["generated_candidate", "literary_theme_ontology"], ["mercy", "the desire for redemption"]),
        ("牺牲", "Sacrifice", "为他者或价值放弃自身利益乃至生命。", ["献身"], ["爱", "勇气", "死亡", "救赎"], "道德社会", ["generated_candidate", "literary_theme_ontology"], ["human self-sacrifice", "sacrifice for a child"]),
        ("勇气", "Courage", "面对恐惧或压力仍坚持行动。", ["勇敢"], ["恐惧", "牺牲", "懦弱"], "品格", ["generated_candidate", "literary_theme_ontology"], ["courage", "courage in the face of death"]),
        ("懦弱", "Cowardice", "因恐惧而退缩、回避应负之责。", ["胆怯"], ["勇气", "恐惧", "羞愧"], "品格", ["generated_candidate", "literary_theme_ontology"], ["cowardice"]),
        ("诚实", "Honesty", "如实言说与行事。", ["率直"], ["虚伪", "信任", "真相"], "品格", ["generated_candidate", "literary_theme_ontology"], ["honesty", "the importance of being honest"]),
        ("虚伪", "Hypocrisy", "表里不一或假装道德。", ["伪善"], ["诚实", "羞耻", "社会"], "品格", ["annotation_benchmark", "generated_candidate"], []),
        ("腐败", "Corruption", "权力或道德的堕落与败坏。", ["腐化"], ["权力", "罪", "虚伪"], "社会", ["generated_candidate", "literary_theme_ontology"], ["corruption in society", "power corrupts"]),
        ("罪", "Sin", "过错、罪责或道德/宗教意义上的堕落。", ["罪恶", "罪过"], ["内疚", "救赎", "信仰"], "道德宗教", ["generated_candidate", "literary_theme_ontology"], ["sin"]),
        ("救赎", "Redemption", "从罪责或堕落中寻求挽回与更新。", ["赎罪"], ["罪", "宽恕", "牺牲"], "道德宗教", ["generated_candidate", "literary_theme_ontology"], ["the desire for redemption"]),
        ("信仰", "Faith", "对超越性、教义或终极意义的信靠。", ["信念"], ["怀疑", "灵魂", "意义"], "道德宗教", ["generated_candidate", "literary_theme_ontology"], ["the importance of faith", "folk belief"]),
        ("怀疑", "Doubt", "对信念、他者或自我的不确定。", ["疑虑"], ["信仰", "真相", "焦虑"], "认知", ["generated_candidate"], []),
        ("真相", "Truth", "真实、揭示与是否说穿。", ["真理", "真实"], ["谎言", "诚实", "幻觉"], "认知", ["generated_candidate", "literary_theme_ontology"], ["what is truth"]),
        ("谎言", "Lie", "故意不实的言说或伪装。", ["欺骗"], ["真相", "虚伪", "信任"], "认知", ["generated_candidate", "literary_theme_ontology"], ["self-deception"]),
        ("秘密社会", "Conspiracy", "隐秘操控与密谋结构的想象（谨慎使用）。", ["阴谋"], ["权力", "真相", "恐惧"], "社会", ["generated_candidate"], [],),
        ("阶级", "Class", "社会经济分层及其造成的差距与偏见。", ["阶层"], ["贫穷", "权力", "身份"], "社会", ["generated_candidate", "literary_theme_ontology"], ["poverty in society"]),
        ("贫穷", "Poverty", "物质匮乏与由此产生的生存压力。", ["贫困"], ["饥饿", "阶级", "尊严"], "社会", ["generated_candidate", "literary_theme_ontology"], ["poverty in society"]),
        ("饥饿", "Hunger", "食物匮乏或强烈匮乏驱动。", ["挨饿"], ["贫穷", "欲望", "身体"], "社会", ["generated_candidate"], []),
        ("工作", "Work", "劳动、职业处境与工作对人的塑造。", ["劳动", "职业"], ["日常", "倦怠", "阶级"], "社会", ["generated_candidate", "literary_theme_ontology"], ["humans at work"]),
        ("教育", "Education", "学习、教化与知识权力关系。", ["求学"], ["成长", "权力", "童年"], "社会", ["generated_candidate"], []),
        ("法律", "Law", "规则、裁决与制度化的约束力量。", ["律法"], ["公正", "罪", "权力"], "社会", ["generated_candidate", "literary_theme_ontology"], ["crime", "what is justice"]),
        ("犯罪", "Crime", "违法或被社会定罪的行为。", ["罪行"], ["罪", "暴力", "惩罚"], "社会", ["generated_candidate", "literary_theme_ontology"], ["crime", "murder", "violent crime"]),
        ("惩罚", "Punishment", "对过错施加的惩戒与其正义性。", ["惩戒"], ["公正", "罪", "宽恕"], "社会", ["generated_candidate"], []),
        ("奴役", "Slavery", "人身自由被剥夺、被占有与剥削。", ["奴役制"], ["压迫", "自由", "暴力"], "社会", ["generated_candidate", "literary_theme_ontology"], ["slavery", "modern slavery"]),
        ("偏见", "Prejudice", "先入为主的贬低或排斥。", ["成见"], ["仇恨", "身份", "阶级"], "社会", ["generated_candidate", "literary_theme_ontology"], ["sexism in society"]),
        ("现代性", "Modernity", "现代社会的速度、技术与疏离经验。", ["现代"], ["城市", "技术", "疏离"], "社会", ["generated_candidate"], []),
        ("技术", "Technology", "工具与技术系统如何改变人与世界。", ["科技"], ["现代性", "权力", "身体"], "社会", ["generated_candidate"], []),
        ("移民", "Migration", "跨地域迁徙及其身份/归属后果。", ["迁徙"], ["家园", "流亡", "归属"], "社会", ["generated_candidate", "literary_theme_ontology"], ["immigration in society"]),
        # culture / aesthetic / illness
        ("美", "Beauty", "美感、审美判断与对美的追求或幻灭。", ["美丽"], ["艺术", "欲望", "表象"], "审美", ["generated_candidate", "literary_theme_ontology"], ["what is beauty", "aesthetics"]),
        ("丑", "Ugliness", "被视为丑陋、不堪或令人不适的审美/道德感受。", ["丑陋"], ["美", "厌恶", "身体"], "审美", ["generated_candidate"], []),
        ("艺术", "Art", "艺术创造与审美实践的意义。", ["文艺"], ["美", "音乐", "表达"], "文化", ["generated_candidate", "literary_theme_ontology"], ["aesthetics"]),
        ("音乐", "Music", "音乐作为情感、记忆与意义的载体。", ["乐曲"], ["记忆", "怀旧", "艺术"], "文化", ["annotation_benchmark", "generated_candidate", "literary_theme_ontology"], ["music"]),
        ("书籍", "Books", "阅读、书籍物象及其知识/慰藉功能。", ["阅读"], ["记忆", "寻找", "智慧"], "文化", ["annotation_benchmark", "generated_candidate"], []),
        ("语言", "Language", "言说、命名与表达能否抵达的问题。", ["言说"], ["沉默", "真相", "误解"], "文化", ["generated_candidate"], []),
        ("误解", "Misunderstanding", "彼此理解失败或意义错位。", ["误会"], ["语言", "孤独", "爱情"], "关系", ["annotation_benchmark", "generated_candidate"], []),
        ("表演", "Performance", "展示、扮演与被观看的自我。", ["扮演"], ["虚伪", "身份", "社交"], "社会自我", ["annotation_benchmark", "generated_candidate"], []),
        ("社交", "Social Life", "人际往来、场面与社会互动。", ["交际"], ["孤独", "表演", "疏离"], "社会自我", ["annotation_benchmark", "generated_candidate"], []),
        ("疾病", "Illness", "身体或精神的病痛与其社会意义。", ["病痛"], ["身体", "死亡", "痛苦", "脆弱"], "身心", ["generated_candidate", "literary_theme_ontology"], ["mental illness", "coping with a terminal illness"]),
        ("创伤", "Trauma", "剧烈伤害留下的持久心理裂痕。", ["心里创伤"], ["记忆", "恐惧", "暴力", "童年"], "身心", ["generated_candidate", "literary_theme_ontology"], ["childhood trauma", "coping with post-traumatic stress"]),
        ("成瘾", "Addiction", "对物质或行为的失控依赖。", ["沉溺"], ["欲望", "失控", "身体"], "身心", ["generated_candidate", "literary_theme_ontology"], ["human addiction", "overcoming an addiction"]),
        ("自杀", "Suicide", "结束自己生命的意念、行动或其阴影。", ["自尽"], ["死亡", "绝望", "痛苦"], "存在", ["generated_candidate", "literary_theme_ontology"], ["suicide", "contemplating suicide"]),
        ("谋杀", "Murder", "故意杀害他人及其动机、罪责与后果。", ["杀害"], ["死亡", "暴力", "罪", "报复"], "社会", ["generated_candidate", "literary_theme_ontology"], ["murder"]),
        ("抛弃", "Abandonment", "被离开、被弃置或切断依赖。", ["遗弃", "舍弃"], ["失去", "童年", "依恋", "恐惧"], "关系", ["generated_candidate", "literary_theme_ontology"], ["abandonment"]),
        ("观察", "Observation", "注视、打量与认知他者/世界。", ["打量"], ["判断", "疏离", "自我"], "认知", ["annotation_benchmark", "generated_candidate"], []),
        ("判断", "Judgment", "评价、定罪或道德裁定。", ["评判"], ["偏见", "公正", "羞愧"], "认知", ["annotation_benchmark", "generated_candidate"], []),
        ("空间", "Space", "空间感受、边界与压迫/开放感（非具体场景时刻）。", ["场所感"], ["压迫", "自由", "家园"], "感知", ["annotation_benchmark", "generated_candidate"], [],),
        ("时间流逝", "Passage of Time", "感到时间过去、不可逆的变易意识（非 Scene/Time 标签）。", ["岁月"], ["记忆", "衰老", "怀旧", "死亡"], "存在", ["generated_candidate"], [],),
        ("表达", "Expression", "情感或思想如何被说出、写出或演出。", ["抒发"], ["语言", "艺术", "压抑"], "文化", ["generated_candidate"], []),
        ("尊严", "Dignity", "人格不受践踏的自我与社会承认。", ["体面"], ["屈辱", "贫穷", "权力"], "道德", ["generated_candidate"], []),
        ("命运感", "Sense of Destiny", "感到事件被更大力量牵引的主观体验。", [], ["命运", "自由", "意义"], "存在", ["generated_candidate"], [],),
        ("神", "God", "神性存在、神圣他者或其缺席。", ["上帝", "神性"], ["信仰", "罪", "灵魂"], "宗教", ["generated_candidate", "literary_theme_ontology"], ["the importance of faith"]),
        ("来世", "Afterlife", "死后世界或灵魂去向的想象。", ["死后"], ["死亡", "信仰", "灵魂"], "宗教", ["generated_candidate", "literary_theme_ontology"], ["the afterlife"]),
        ("动物", "Animals", "动物作为生命他者、象征或伦理对象。", ["野兽"], ["自然", "怜悯", "暴力"], "世界", ["generated_candidate"], []),
        ("食物", "Food", "饮食、喂养与围绕食物的情感/权力。", ["吃"], ["饥饿", "家庭", "身体"], "日常", ["generated_candidate"], []),
        ("财富", "Wealth", "富有、占有资源及其道德/社会效应。", ["金钱", "富有"], ["贫穷", "权力", "欲望"], "社会", ["generated_candidate"], []),
        ("名声", "Fame", "被看见、被谈论的名望及其代价。", ["名誉", "名气"], ["表演", "虚荣", "孤独"], "社会", ["generated_candidate"], []),
        ("虚荣", "Vanity", "过度在意外表或他人评价。", ["爱慕虚荣"], ["骄傲", "表演", "美"], "品格", ["generated_candidate"], []),
        ("等待", "Waiting", "悬置中的期待、焦灼或空耗。", ["等候"], ["希望", "焦虑", "时间流逝"], "存在", ["generated_candidate"], []),
        ("归来", "Return", "回到原处、原关系或原身份。", ["返回"], ["团聚", "家园", "旅行"], "空间情感", ["annotation_benchmark", "generated_candidate"], []),
        ("破坏", "Destruction", "摧毁既有事物或秩序。", ["毁坏"], ["暴力", "衰败", "战争"], "存在", ["annotation_benchmark", "generated_candidate"], []),
        ("保护", "Protection", "守护他者免受伤害。", ["庇护"], ["爱", "恐惧", "牺牲"], "关系", ["generated_candidate"], []),
        ("教育缺失", "Neglect in Upbringing", "养育缺失或无人引导的成长缺口。", ["疏于教养"], ["童年", "抛弃", "创伤"], "关系", ["generated_candidate"], [],),
        ("伦理困境", "Ethical Dilemma", "价值冲突下难以两全的抉择。", ["道德两难"], ["责任", "选择", "牺牲"], "道德", ["generated_candidate", "literary_theme_ontology"], ["coping with life issues"]),
        ("人性", "Human Nature", "关于人固有倾向、善恶与限度的思索。", ["人之本性"], ["善恶", "欲望", "暴力"], "存在", ["generated_candidate", "literary_theme_ontology"], ["human nature", "the human capacity for good and evil"]),
        ("善恶", "Good and Evil", "道德上的善与恶及其边界。", ["好坏"], ["人性", "罪", "救赎"], "道德", ["generated_candidate", "literary_theme_ontology"], ["the human capacity for good and evil"]),
        ("秩序", "Order", "规则、结构化稳定与其压制面向。", ["条理"], ["混乱", "自由", "权力"], "社会", ["generated_candidate", "literary_theme_ontology"], ["order vs. freedom"]),
        ("混乱", "Chaos", "失序、不可预测与结构崩解。", ["无序"], ["秩序", "恐惧", "自由"], "社会", ["generated_candidate"], []),
        ("未来", "Future", "尚未到来的时间及其忧惧或希望。", ["前途"], ["希望", "焦虑", "命运"], "存在", ["generated_candidate"], []),
        ("过去", "Past", "已发生之事对当下的压力与召回。", ["往昔"], ["记忆", "怀旧", "历史"], "存在", ["generated_candidate"], []),
        ("历史", "History", "集体过去、记述与历史意识。", ["史事"], ["记忆", "战争", "真相"], "文化", ["generated_candidate", "literary_theme_ontology"], ["history"]),
        ("传统", "Tradition", "被传承的习俗、规范与其束缚/安慰。", ["习俗"], ["家庭", "反叛", "身份"], "文化", ["generated_candidate"], []),
        ("反叛", "Rebellion", "对权威、规范或命运的违抗。", ["叛逆"], ["自由", "青春", "压迫"], "社会", ["generated_candidate", "literary_theme_ontology"], ["youth rebellion"]),
        ("适应", "Adaptation", "调整自身以应对环境变化。", ["顺应"], ["变化", "生存", "身份"], "存在", ["generated_candidate"], []),
        ("生存", "Survival", "在压力下活下去的优先目标。", ["活命"], ["死亡", "恐惧", "饥饿"], "存在", ["generated_candidate", "literary_theme_ontology"], ["the desire to survive"]),
        ("倾听", "Listening", "认真听取他者或世界的声音。", ["聆听"], ["寂静", "体谅", "语言"], "关系", ["generated_candidate"], []),
        ("沉默", "Muteness", "不说出口、被迫或主动的无言。", ["不语"], ["寂静", "压抑", "秘密"], "表达", ["generated_candidate", "literary_theme_ontology"], ["vow of silence"]),
        ("目光", "Gaze", "看与被看所形成的权力或欲望关系。", ["注视"], ["观察", "欲望", "表演"], "感知", ["generated_candidate"], []),
        ("气味", "Smell", "嗅觉触发的记忆与情感（感知主题，非修辞）。", ["嗅觉"], ["记忆", "怀旧", "身体"], "感知", ["generated_candidate"], []),
        ("触感", "Touch", "触觉亲密、伤害或物质质地经验。", ["触觉"], ["身体", "亲密", "暴力"], "感知", ["generated_candidate"], []),
        ("亲密", "Intimacy", "深度靠近的情感/身体亲近。", ["亲近"], ["爱", "脆弱", "性"], "关系", ["generated_candidate"], []),
        ("距离", "Distance", "物理或情感上的间隔。", ["疏远"], ["分离", "孤独", "疏离"], "关系", ["generated_candidate"], []),
        ("边界", "Boundary", "自我/他者、内/外的界限及其被侵越。", ["界限"], ["空间", "亲密", "权力"], "关系", ["generated_candidate"], []),
        ("仪式", "Ritual", "重复性的象征行为与其社会/心理功能。", ["典礼"], ["传统", "死亡", "信仰"], "文化", ["generated_candidate"], []),
        ("游戏", "Play", "玩耍、规则内的自由与假装。", ["玩乐"], ["童年", "表演", "自由"], "文化", ["generated_candidate"], []),
        ("竞争", "Competition", "争夺胜负、资源或承认。", ["角逐"], ["嫉妒", "工作", "权力"], "社会", ["generated_candidate"], []),
        ("合作", "Cooperation", "共同行动与相互依赖。", ["协作"], ["友情", "信任", "社会"], "社会", ["generated_candidate"], []),
        ("领导", "Leadership", "带领、权威与责任的集中。", ["领袖"], ["权力", "责任", "跟随"], "社会", ["generated_candidate"], []),
        ("跟随", "Followership", "追随权威或潮流的位置。", ["追随"], ["领导", "信仰", "自由"], "社会", ["generated_candidate"], []),
        ("流言", "Rumor", "未经证实却流通的说法。", ["谣言"], ["名誉", "真相", "社交"], "社会", ["generated_candidate"], []),
        ("禁忌", "Taboo", "不可触碰的规范与其诱惑。", ["忌讳"], ["欲望", "罪", "秘密"], "文化", ["generated_candidate"], []),
        ("干净", "Purity", "洁净、纯洁及其道德化想象。", ["纯洁"], ["污染", "纯真", "身体"], "道德", ["generated_candidate"], []),
        ("污染", "Contamination", "被弄脏、侵染或道德沾污。", ["玷污"], ["干净", "疾病", "羞耻"], "道德", ["generated_candidate"], []),
        ("温度", "Warmth", "温暖作为照料、人情或环境感受的隐喻领地。", ["暖意"], ["家园", "爱", "孤独"], "感知", ["generated_candidate"], []),
        ("寒冷", "Coldness", "冷作为疏离、严酷或情感缺失的感受。", ["冰冷"], ["孤独", "死亡", "自然"], "感知", ["generated_candidate"], []),
        ("光", "Light", "光明、显现与启示的象征领地。", ["光明"], ["黑暗", "真相", "希望"], "感知", ["generated_candidate"], []),
        ("黑暗", "Darkness", "暗夜、隐蔽与未知的压迫或庇护。", ["暗"], ["光", "恐惧", "秘密"], "感知", ["generated_candidate"], []),
        ("水", "Water", "水流、淹没、清洗与流动的意义领地。", ["河海"], ["自然", "死亡", "净化"], "世界", ["generated_candidate"], []),
        ("火", "Fire", "燃烧、热情、毁灭与净化。", ["火焰"], ["欲望", "破坏", "愤怒"], "世界", ["generated_candidate"], []),
        ("土地", "Land", "土地、扎根与耕作/占有关系。", ["大地"], ["家园", "自然", "归属"], "世界", ["generated_candidate"], []),
        ("天空", "Sky", "开阔、超越与天气意象的意义领地。", ["苍穹"], ["自由", "自然", "希望"], "世界", ["generated_candidate"], []),
        ("夜晚", "Night", "夜间作为心理/象征时间（非 Scene 标签枚举替代，研究候选）。", ["黑夜"], ["黑暗", "孤独", "梦"], "感知", ["generated_candidate"], [],),
        ("早晨", "Morning", "开始、苏醒与清新再出发的象征领地。", ["清晨"], ["希望", "重生", "日常"], "感知", ["generated_candidate"], [],),
    ]

    # Deduplicate nights/mornings notes: mark as ambiguous vs scene_time in notes below via status if needed
    for zh, en, definition, aliases, related, category, prov, lto in core:
        status = "active_candidate"
        notes = ""
        if zh in ("夜晚", "早晨", "空间"):
            status = "active_candidate"
            notes = "Borderline vs Scene/Time or spatial scene tags; kept as Theme candidate for semantic territory, pending 1.42+ review."
        if zh == "秘密社会":
            notes = "Low priority / possibly too plot-genre; retained for inspectability."
        if zh == "教育缺失":
            notes = "More specific than preferred; retained pending evidence of retrieval usefulness."
        add(
            zh=zh,
            en=en,
            definition=definition,
            aliases=aliases,
            related=related,
            category=category,
            provenance=prov,
            lto_names=lto,
            status=status,
            notes=notes,
        )

    return T


def build_device_seeds() -> list[dict]:
    D = []
    # existing
    existing = [
        ("隐喻", "Metaphor", "以彼喻此，用一事物暗示另一事物的深层相似。", ["暗喻"], ["比喻", "象征"], ["existing_pgwhite", "legacy_human"], ["pgwhite:tag:19"]),
        ("拟人", "Personification", "把非人事物当作人来写，赋予人的动作或情感。", ["人格化"], ["比喻", "通感"], ["existing_pgwhite", "legacy_human", "annotation_benchmark"], ["pgwhite:tag:20"]),
        ("头韵", "Alliteration", "相邻或邻近词语声母/起音重复的语音修辞。", [], ["重复"], ["existing_pgwhite"], ["pgwhite:tag:21"], "Zero production assignments; retained as conventional term."),
        ("内涵", "Connotation", "词语或意象在字面之外的联想意义。", ["意涵"], ["象征", "意象"], ["existing_pgwhite", "legacy_human"], ["pgwhite:tag:22"], "Product-historical Device; overlaps Theme-ish semantics — review later."),
        ("意象", "Imagery", "可感知的形象单元及其组合所形成的画面感。", ["形象"], ["象征", "比喻"], ["existing_pgwhite", "legacy_human"], ["pgwhite:tag:23"]),
        ("外貌描写", "Appearance Description", "对人物外貌特征的刻画。", ["肖像描写"], ["动作描写", "心理描写"], ["existing_pgwhite", "legacy_human", "annotation_benchmark"], ["pgwhite:tag:24"]),
        ("动作描写", "Action Description", "对人物动作与行为过程的刻画。", [], ["外貌描写", "心理描写"], ["existing_pgwhite", "legacy_human", "annotation_benchmark"], ["pgwhite:tag:25"]),
        ("长句描写", "Long-Sentence Description", "以较长句法展开绵密描写的表现方式。", ["长句"], [], ["existing_pgwhite", "legacy_human"], ["pgwhite:tag:26"], "Narrow craft label; keep conservative."),
        ("通感", "Synesthesia", "打通不同感官，以一种感觉写另一种感觉。", ["联觉"], ["比喻", "意象"], ["existing_pgwhite", "legacy_human", "annotation_benchmark"], ["pgwhite:tag:27"]),
        ("心理描写", "Psychological Description", "对内心活动、思绪与情感过程的刻画。", ["内心描写"], ["动作描写", "外貌描写"], ["existing_pgwhite", "legacy_human"], ["pgwhite:tag:28"]),
    ]
    for row in existing:
        zh, en, definition, aliases, related, prov, refs = row[:7]
        notes = row[7] if len(row) > 7 else ""
        D.append(device(zh, en, definition, aliases=aliases, related=related, provenance=prov, source_refs=refs, notes=notes))

    extra = [
        ("比喻", "Simile/Analogy", "用相似物说明本体，包括明喻等常见比喻用法。", ["譬喻", "明喻"], ["隐喻", "象征"], ["annotation_benchmark", "generated_candidate"]),
        ("象征", "Symbolism", "以具体形象稳定指向抽象意义。", [], ["隐喻", "意象"], ["annotation_benchmark", "generated_candidate"]),
        ("排比", "Parallelism", "结构相似的短语或句子并列推进。", [], ["重复", "对比"], ["annotation_benchmark", "generated_candidate"]),
        ("反讽", "Irony", "字面与真意相反或情境与期待错位造成的讽刺效果。", ["讽刺"], ["对比"], ["annotation_benchmark", "generated_candidate"]),
        ("夸张", "Hyperbole", "故意夸大或缩小以突出特征。", ["夸饰"], ["比喻"], ["annotation_benchmark", "generated_candidate"]),
        ("白描", "Plain Description", "少修饰、以简练线条勾勒对象。", [], ["细节描写"], ["annotation_benchmark", "generated_candidate"]),
        ("借代", "Metonymy/Synecdoche", "用相关或局部特征指代本体。", ["换喻"], ["比喻", "象征"], ["annotation_benchmark", "generated_candidate"]),
        ("对比", "Contrast", "并置差异以凸显特征或主题张力。", ["对照"], ["反讽", "排比"], ["annotation_benchmark", "generated_candidate"]),
        ("重复", "Repetition", "词语、结构或意象的有意反复。", ["反复"], ["排比", "头韵"], ["generated_candidate"]),
        ("设问", "Rhetorical Question", "明知故问或引导思考的问句形式。", ["反问"], [], ["generated_candidate"]),
        ("反问", "Rhetorical Challenge", "用疑问形式加强肯定/否定语气。", [], ["设问"], ["generated_candidate"]),
        ("双关", "Pun/Double Meaning", "一语同时关联双重含义。", [], ["反讽"], ["generated_candidate"]),
        ("对比描写", "Contrasting Description", "通过对照性描写强化差异（保守保留）。", [], ["对比"], ["generated_candidate"], "Possibly redundant with 对比; kept for inspectability."),
        ("细节描写", "Detailed Description", "以具体细部刻画增强实感与意味。", ["细描"], ["白描", "意象"], ["annotation_benchmark", "generated_candidate"]),
        ("环境描写", "Setting Description", "对环境气氛与物象环境的刻画（手法，非 Scene 标签）。", ["景物描写"], ["意象", "细节描写"], ["annotation_benchmark", "generated_candidate"]),
        ("侧面描写", "Indirect Characterization", "通过他者反应或相关物侧面表现对象。", ["间接描写"], ["对比", "象征"], ["generated_candidate"]),
        ("留白", "Narrative Ellipsis", "有意省略以唤起想象或余味。", ["空白"], ["暗示"], ["annotation_benchmark", "generated_candidate"]),
        ("暗示", "Suggestion/Implication", "不明说而让意义被推断出来。", ["暗示"], ["象征", "留白"], ["generated_candidate"]),
        ("引用", "Allusion/Quotation", "援引成说、典故或他文以增生意义。", ["用典", "典故"], ["象征"], ["generated_candidate"]),
        ("拟声", "Onomatopoeia", "摹仿声音的词语运用。", ["象声"], [], ["annotation_benchmark", "generated_candidate"]),
        ("通篇象征", "Extended Symbol", "象征在较长篇幅中持续展开（谨慎、低频）。", [], ["象征"], ["generated_candidate"], "Borderline compositional; status review later."),
    ]
    for row in extra:
        zh, en, definition, aliases, related, prov = row[:6]
        notes = row[6] if len(row) > 6 else ""
        D.append(device(zh, en, definition, aliases=aliases, related=related, provenance=prov, notes=notes))
    return D


def main() -> None:
    tax = load_json(REPO / "research/annotation-workbench/fixtures/taxonomy.v1.json")
    bench = load_json(REPO / "research/annotation-workbench/fixtures/benchmark.v1.json")
    lto = load_json(DATA / "lto/themes-selected.v1.json")
    bench_th, bench_dv = collect_free_concepts()

    legacy_theme = Counter()
    legacy_device = Counter()
    legacy_scene = Counter()
    for q in bench["quotes"]:
        for t in q.get("legacyTags") or []:
            if t["dimension"] == "theme":
                legacy_theme[t["zh"]] += 1
            elif t["dimension"] == "device":
                legacy_device[t["zh"]] += 1
            elif t["dimension"] == "scene_time":
                legacy_scene[t["zh"]] += 1

    dump(
        DATA / "sources/existing-pgwhite.v1.json",
        {
            "schema_version": "tag-source.v1",
            "provenance": "existing_pgwhite",
            "extracted_at": NOW,
            "taxonomy_version": tax.get("taxonomyVersion"),
            "themes": [
                {
                    "zh": t["zh"],
                    "en": t.get("en"),
                    "production_tag_id": t["id"],
                    "assignment_count": t.get("assignmentCount"),
                }
                for t in tax["tags"]
                if t["dimension"] == "theme"
            ],
            "devices": [
                {
                    "zh": t["zh"],
                    "en": t.get("en"),
                    "production_tag_id": t["id"],
                    "assignment_count": t.get("assignmentCount"),
                }
                for t in tax["tags"]
                if t["dimension"] == "device"
            ],
        },
    )
    dump(
        DATA / "sources/legacy-human.v1.json",
        {
            "schema_version": "tag-source.v1",
            "provenance": "legacy_human",
            "extracted_at": NOW,
            "fixture_version": bench.get("fixtureVersion"),
            "fixture_content_hash": bench.get("contentHash"),
            "theme_counts": dict(legacy_theme),
            "device_counts": dict(legacy_device),
            "scene_time_counts": dict(legacy_scene),
            "note": "Legacy human tags are weak references only. Scene/Time listed for exclusion evidence.",
        },
    )
    dump(
        DATA / "sources/annotation-benchmark.v1.json",
        {
            "schema_version": "tag-source.v1",
            "provenance": "annotation_benchmark",
            "extracted_at": NOW,
            "runs": [
                "atomic-v1.2-calib-12",
                "atomic-v1.2-calib-12-nano",
                "smoke-free-concepts-v1.2",
                "smoke-free-concepts-v1.1",
            ],
            "theme_counts": dict(bench_th),
            "device_counts": dict(bench_dv),
            "note": "Includes compound/noisy labels retained as cleanup evidence.",
        },
    )

    theme_seeds = build_theme_seeds()
    device_seeds = build_device_seeds()

    # ---------- RAW CANDIDATES (pre-cleanup evidence) ----------
    raw_themes = []
    raw_id = 1

    def add_raw(label, provenance, *, en=None, note="", evidence=None):
        nonlocal raw_id
        raw_themes.append(
            {
                "raw_id": f"raw-theme-{raw_id:04d}",
                "label_zh": label,
                "label_en": en,
                "provenance": provenance if isinstance(provenance, list) else [provenance],
                "evidence": evidence or {},
                "notes": note,
            }
        )
        raw_id += 1

    for t in tax["tags"]:
        if t["dimension"] == "theme":
            add_raw(t["zh"], "existing_pgwhite", en=t.get("en"), evidence={"production_tag_id": t["id"]})
    for zh, c in legacy_theme.items():
        add_raw(zh, "legacy_human", evidence={"count": c})
    for zh, c in bench_th.items():
        add_raw(zh, "annotation_benchmark", evidence={"count": c})

    # LTO-inspired Chinese labels already in seeds; also record English upstream names as raw research concepts
    for th in lto["themes"]:
        if th["depth"] <= 4 and th.get("definition") and len(th["upstream_name"].split()) <= 4:
            add_raw(
                th["upstream_name"],
                "literary_theme_ontology",
                note="Upstream English theme name (not a PGWhite canonical label).",
                evidence={"upstream_id": th["upstream_id"], "depth": th["depth"], "parents": th["parents"]},
            )

    generated_labels = [t["zh"] for t in theme_seeds if "generated_candidate" in t["provenance"]]
    for zh in generated_labels:
        add_raw(zh, "generated_candidate", note="Offline generative/editorial suggestion for reusable literary Theme.")

    raw_devices = []
    rid = 1
    for t in tax["tags"]:
        if t["dimension"] == "device":
            raw_devices.append(
                {
                    "raw_id": f"raw-device-{rid:04d}",
                    "label_zh": t["zh"],
                    "label_en": t.get("en"),
                    "provenance": ["existing_pgwhite"],
                    "evidence": {"production_tag_id": t["id"]},
                }
            )
            rid += 1
    for zh, c in legacy_device.items():
        raw_devices.append(
            {
                "raw_id": f"raw-device-{rid:04d}",
                "label_zh": zh,
                "provenance": ["legacy_human"],
                "evidence": {"count": c},
            }
        )
        rid += 1
    for zh, c in bench_dv.items():
        raw_devices.append(
            {
                "raw_id": f"raw-device-{rid:04d}",
                "label_zh": zh,
                "provenance": ["annotation_benchmark"],
                "evidence": {"count": c},
            }
        )
        rid += 1
    for d in device_seeds:
        if "generated_candidate" in d["provenance"] or (
            "annotation_benchmark" in d["provenance"] and "existing_pgwhite" not in d["provenance"]
        ):
            raw_devices.append(
                {
                    "raw_id": f"raw-device-{rid:04d}",
                    "label_zh": d["zh"],
                    "label_en": d["en"],
                    "provenance": d["provenance"],
                    "evidence": {},
                }
            )
            rid += 1

    dump(
        DATA / "candidates/theme-raw.v1.json",
        {
            "schema_version": "tag-candidates-raw.v1",
            "created_at": NOW,
            "counts_by_provenance": dict(
                Counter(p for r in raw_themes for p in r["provenance"])
            ),
            "unique_labels": len({r["label_zh"] for r in raw_themes}),
            "candidates": raw_themes,
        },
    )
    dump(
        DATA / "candidates/device-raw.v1.json",
        {
            "schema_version": "tag-candidates-raw.v1",
            "created_at": NOW,
            "counts_by_provenance": dict(
                Counter(p for r in raw_devices for p in r["provenance"])
            ),
            "unique_labels": len({r["label_zh"] for r in raw_devices}),
            "candidates": raw_devices,
        },
    )

    # ---------- CLEANUP LOG ----------
    cleanup = []

    def decision(action, label, reason, *, maps_to=None, dimension=None, provenance=None):
        cleanup.append(
            {
                "action": action,  # merge|exclude|reclassify|decompose|keep_alias|keep_related
                "label": label,
                "maps_to": maps_to,
                "dimension": dimension,
                "reason": reason,
                "provenance": provenance or [],
            }
        )

    # Scene/Time exclusions
    for zh in legacy_scene:
        decision(
            "exclude",
            zh,
            "Scene/Time dimension label; not reactivated as Theme in 1.41.",
            dimension="scene_time",
            provenance=["legacy_human"],
        )
    decision(
        "exclude",
        "时间",
        "Existing Theme collides with Scene/Time reconsideration; retained in library with status excluded_scene_time_conflict but not active.",
        maps_to=None,
        dimension="theme",
        provenance=["existing_pgwhite"],
    )

    # Compound decompositions from benchmark
    compounds = [
        ("音乐唤醒记忆", ["音乐", "记忆"], "Compound causal summary → atomic components."),
        ("记忆与损伤", ["记忆"], "Compound analysis title; damage/衰败 may co-tag separately when evidenced."),
        ("记忆的损伤", ["记忆", "衰败"], "Quote-specific compound."),
        ("童年回忆", ["童年", "记忆"], "Composable pair collapsed into one label."),
        ("记忆唤起", ["记忆"], "Process paraphrase of 记忆."),
        ("珍视之物的脆弱", ["珍视", "脆弱"], "Literary-analysis sentence masquerading as tag."),
        ("复杂的父子关系", ["父亲", "亲情"], "Relationship enumeration/analysis title."),
        ("记忆衰退", ["记忆", "衰败"], "Compound of memory + decay."),
        ("记忆的纪念物", ["记忆", "珍视"], "Over-specific object framing."),
        ("音乐意义", ["音乐", "意义"], "Compound."),
        ("记忆与关联", ["记忆"], "Vague compound."),
        ("破坏性影响", ["破坏"], "Analytic paraphrase."),
        ("冲动与失控", ["冲动", "掌控"], "Compound pair."),
        ("暴力/压迫", ["暴力", "压迫"], "Slash compound."),
        ("爱与欲望的区分", ["爱情", "欲望"], "Analytical contrast title."),
        ("关系中的误解", ["误解"], "Prefixed specificity."),
        ("情感意向的非等同", ["误解", "欲望"], "Literary-analysis sentence."),
        ("空间受限", ["空间", "压迫"], "Compound spatial analysis."),
        ("空间分割", ["空间"], "Over-specific."),
        ("离开与归来", ["离开", "归来"], "Pair compound."),
        ("叙事追寻", ["寻找"], "Narratology wording."),
        ("虚无与重建", ["虚无", "重生"], "Compound."),
        ("情感寄托", ["依恋", "珍视"], "Slightly compound; mapped to reusable components."),
        ("自我冲突", ["自我"], "Mildly compound; keep 自我 as canonical."),
        ("情感错位", ["误解", "爱情"], "Analysis title."),
        ("空间压迫", ["空间", "压迫"], "Compound."),
        ("人物刻画", None, "Craft/Device-ish, not Theme; excluded from Theme library."),
        ("外貌描写", None, "Device label appearing in Theme free-concepts; reclassified."),
        ("身体形态特征", ["身体"], "Over-specific physical description as Theme."),
        ("观众认知", ["观察", "判断"], "Over-specific."),
        ("情境差异", None, "Too situational/analytic."),
        ("自我调整", ["自我", "适应"], "Compound process."),
        ("自我审查", ["自我", "压抑"], "Compound."),
        ("屈从", ["压迫"], "Near-synonym/related to oppression; not separate unless needed later."),
        ("伪装", ["虚伪", "表演"], "Maps to reusable concepts."),
        ("单调与重复", ["重复", "无聊"], "Compound."),
        ("安静", ["寂静"], "Near-synonym → alias/merge into 寂静."),
        ("衰退", ["衰败"], "Near-synonym → merge into 衰败."),
        ("伤心", ["悲伤"], "Alias of 悲伤."),
        ("好奇心", ["好奇"], "Near-identical wording."),
        ("厌恶感", ["厌恶"], "Suffix variant."),
        ("不安", ["焦虑"], "Treated as alias territory of 焦虑 for now."),
        ("旅途", ["旅行"], "Near-synonym."),
        ("异化", ["疏离"], "Alias of 疏离."),
    ]
    for label, maps, reason in compounds:
        if maps is None:
            if label in ("人物刻画", "情境差异"):
                decision("exclude", label, reason, dimension="theme", provenance=["annotation_benchmark"])
            elif label == "外貌描写":
                decision(
                    "reclassify",
                    label,
                    reason,
                    maps_to="外貌描写",
                    dimension="device",
                    provenance=["annotation_benchmark"],
                )
            else:
                decision("exclude", label, reason, provenance=["annotation_benchmark"])
        elif len(maps) == 1 and maps[0] != label:
            decision(
                "merge",
                label,
                reason,
                maps_to=maps[0],
                dimension="theme",
                provenance=["annotation_benchmark"],
            )
        else:
            decision(
                "decompose",
                label,
                reason,
                maps_to=maps,
                dimension="theme",
                provenance=["annotation_benchmark"],
            )

    # Device cleanup
    device_bad = [
        ("拟因果的环境指向", "exclude", "Invented analysis-title Device from Nano; no established reusable terminology."),
        ("对称/均分结构", "exclude", "Invented structural analysis title; not conventional Device term."),
        ("因果转折", "exclude", "Ad-hoc narratology label without stable reusable status."),
        ("重复与强调", "decompose", "Split toward 重复; 强调 not added as separate Device yet."),
        ("意象对照", "merge", "Maps toward 对比 / 意象 usage; avoid Device inflation."),
        ("因果象征", "exclude", "Compound invented Device."),
        ("拟人（物件动作化）", "merge", "Parenthetical variant of 拟人."),
        ("贬抑性意象", "exclude", "Over-specific evaluative Device title."),
        ("拟态/伪装描写", "exclude", "Invented compound Device."),
        ("感官意象描写", "decompose", "Prefer 意象 / 通感 / 细节描写 as established terms."),
        ("细节堆叠", "merge", "Variant of 细节描写."),
        ("空间描写", "merge", "Maps to 环境描写."),
        ("循环结构", "exclude", "Structural analysis title; insufficient evidence as conventional Device."),
        ("联想", "exclude", "Too generic / cognitive, not established Device term for library v1."),
        ("以小见大", "exclude", "Critical cliché rather than stable Device atom for retrieval."),
        ("感官触发回忆", "exclude", "Theme-ish compound (记忆) disguised as Device."),
        ("以声写静", "exclude", "Technique paraphrase; not canonical Device name."),
        ("辨析", "exclude", "Not a literary Device term."),
        ("听觉描写", "merge", "Prefer 细节描写 / 通感 / 环境描写 depending on use; not separate canonical yet."),
        ("听觉意象", "merge", "Prefer 意象."),
        ("借物抒情", "exclude", "School-essay formula; overly instructional, not atomic Device."),
        ("肖像描写", "merge", "Alias of 外貌描写."),
    ]
    for label, action, reason in device_bad:
        maps = None
        if action == "merge":
            if "拟人" in label:
                maps = "拟人"
            elif label in ("细节堆叠",):
                maps = "细节描写"
            elif label == "空间描写":
                maps = "环境描写"
            elif label == "肖像描写":
                maps = "外貌描写"
            elif label == "意象对照":
                maps = "对比"
            elif label in ("听觉描写", "听觉意象"):
                maps = "意象"
            else:
                maps = None
        elif action == "decompose":
            if label == "重复与强调":
                maps = ["重复"]
            elif label == "感官意象描写":
                maps = ["意象", "通感", "细节描写"]
        decision(action, label, reason, maps_to=maps, dimension="device", provenance=["annotation_benchmark"])

    # Entity enumeration principle notes
    decision(
        "exclude",
        "父子关系",
        "Avoid enumerating every kinship subtype as canonical Theme; prefer 亲情 + 父亲 when needed.",
        provenance=["manual"],
    )
    decision(
        "exclude",
        "母女关系",
        "Same abstraction boundary as other kinship enumerations.",
        provenance=["manual"],
    )

    dump(
        DATA / "candidates/cleanup-log.v1.json",
        {
            "schema_version": "cleanup-decision.v1",
            "created_at": NOW,
            "policy": [
                "Do not silently delete evidence — raw candidates retained.",
                "Aliases ≠ related concepts.",
                "Prefer reusable literary atoms over entity/relation enumeration and analysis titles.",
                "High recall over strict precision for Personal-tag fallthrough later.",
                "Scene/Time not reactivated.",
                "Invented Device analysis titles excluded without external evidence.",
            ],
            "decisions": cleanup,
            "summary": dict(Counter(d["action"] for d in cleanup)),
        },
    )

    # ---------- FINAL LIBRARY ----------
    # Deduplicate theme seeds by zh (last write wins but seeds are unique)
    by_zh = {}
    for t in theme_seeds:
        by_zh[t["zh"]] = t
    # Apply alias merges into canonical records
    alias_merges = {
        "伤心": "悲伤",
        "难过": "悲伤",
        "哀伤": "悲伤",
        "安静": "寂静",
        "沉默": "寂静",  # also alias already
        "衰退": "衰败",
        "异化": "疏离",
        "不安": "焦虑",
        "旅途": "旅行",
        "好奇心": "好奇",
        "厌恶感": "厌恶",
        "愧疚": "内疚",
    }
    for alias, canon in alias_merges.items():
        if canon in by_zh and alias not in by_zh[canon]["aliases"] and alias != canon:
            by_zh[canon]["aliases"].append(alias)

    final_themes = []
    for i, zh in enumerate(sorted(by_zh.keys(), key=lambda x: (by_zh[x]["category"], x)), start=1):
        t = by_zh[zh]
        aliases = sorted({a for a in t["aliases"] if a and a != t["zh"]})
        rid = slug_id("theme", zh, i)
        final_themes.append(
            {
                "id": rid,
                "canonical_zh": t["zh"],
                "label_en": t["en"],
                "dimension": "theme",
                "definition": t["definition"],
                "aliases": aliases,
                "related": t["related"],
                "parents": t["parents"],
                "category": t["category"],
                "provenance": t["provenance"],
                "source_refs": t["source_refs"],
                "status": t["status"],
                "notes": t["notes"],
                "representations": {
                    "A_label": rep_a(t["zh"]),
                    "B_label_definition": rep_b(t["zh"], t["definition"]),
                    "C_label_definition_aliases": rep_c(t["zh"], t["definition"], aliases),
                },
            }
        )

    final_devices = []
    d_by = {d["zh"]: d for d in device_seeds}
    # alias portrait
    if "外貌描写" in d_by and "肖像描写" not in d_by["外貌描写"]["aliases"]:
        d_by["外貌描写"]["aliases"].append("肖像描写")
    for i, zh in enumerate(sorted(d_by.keys()), start=1):
        d = d_by[zh]
        aliases = sorted({a for a in d["aliases"] if a and a != d["zh"]})
        final_devices.append(
            {
                "id": slug_id("device", zh, i),
                "canonical_zh": d["zh"],
                "label_en": d["en"],
                "dimension": "device",
                "definition": d["definition"],
                "aliases": aliases,
                "related": d["related"],
                "parents": d["parents"],
                "category": d["category"],
                "provenance": d["provenance"],
                "source_refs": d["source_refs"],
                "status": d["status"],
                "notes": d["notes"],
                "representations": {
                    "A_label": rep_a(d["zh"]),
                    "B_label_definition": rep_b(d["zh"], d["definition"]),
                    "C_label_definition_aliases": rep_c(d["zh"], d["definition"], aliases),
                },
            }
        )

    active_themes = [t for t in final_themes if t["status"] == "active_candidate"]
    library = {
        "schema_version": "atomic-tag-library.v1",
        "library_version": LIBRARY_VERSION,
        "created_at": NOW,
        "research_only": True,
        "production_migration": False,
        "philosophy": {
            "tag_is": "a semantically atomic, reusable retrieval component",
            "tag_is_not": "a miniature literary analysis or quote-specific summary",
            "recall_over_precision": True,
            "empty_tags_acceptable": True,
            "fourier_analogy": "PRODUCT/CONCEPTUAL only: a Quote can be decomposed into reusable semantic basis components (Tags), possibly with different relevance strengths. PGWhite does NOT use Fourier Transform, FFT, frequency-domain processing, or DSP.",
        },
        "dimensions": {
            "active": ["theme", "device"],
            "inactive": ["scene_time", "character"],
            "notes": "Scene/Time not reactivated. Character remains outside active tagging.",
        },
        "counts": {
            "themes_total": len(final_themes),
            "themes_active_candidate": len(active_themes),
            "themes_excluded_or_other": len(final_themes) - len(active_themes),
            "devices_total": len(final_devices),
            "raw_theme_rows": len(raw_themes),
            "raw_theme_unique_labels": len({r["label_zh"] for r in raw_themes}),
            "raw_device_rows": len(raw_devices),
            "cleanup_decisions": len(cleanup),
        },
        "provenance_counts_themes": dict(
            Counter(p for t in final_themes for p in t["provenance"])
        ),
        "category_distribution_themes": dict(
            Counter(t["category"] for t in final_themes)
        ),
        "themes": final_themes,
        "devices": final_devices,
    }
    dump(DATA / "library/atomic-tag-library.v1.json", library)

    reps = {
        "schema_version": "tag-representations.v1",
        "library_version": LIBRARY_VERSION,
        "created_at": NOW,
        "embedding_status": "not_computed",
        "note": "Text representations only for future Qwen3-Embedding evaluation in 1.42. Related concepts intentionally excluded from C.",
        "formats": {
            "A": "canonical label only",
            "B": "label + definition (中文冒号连接)",
            "C": "label + definition + aliases (related excluded)",
        },
        "themes": [
            {
                "id": t["id"],
                "canonical_zh": t["canonical_zh"],
                "A": t["representations"]["A_label"],
                "B": t["representations"]["B_label_definition"],
                "C": t["representations"]["C_label_definition_aliases"],
            }
            for t in final_themes
        ],
        "devices": [
            {
                "id": d["id"],
                "canonical_zh": d["canonical_zh"],
                "A": d["representations"]["A_label"],
                "B": d["representations"]["B_label_definition"],
                "C": d["representations"]["C_label_definition_aliases"],
            }
            for d in final_devices
        ],
    }
    dump(DATA / "library/representations.v1.json", reps)

    # generated candidates source file
    dump(
        DATA / "sources/generated-candidates.v1.json",
        {
            "schema_version": "tag-source.v1",
            "provenance": "generated_candidate",
            "created_at": NOW,
            "note": "Offline generative/editorial suggestions for one-time taxonomy construction. Not authoritative literary truth. Not per-Quote GPT calls.",
            "theme_labels": sorted(
                {t["zh"] for t in theme_seeds if "generated_candidate" in t["provenance"]}
            ),
            "device_labels": sorted(
                {
                    d["zh"]
                    for d in device_seeds
                    if "generated_candidate" in d["provenance"]
                }
            ),
        },
    )

    summary = {
        "library_version": LIBRARY_VERSION,
        "themes_total": len(final_themes),
        "themes_active": len(active_themes),
        "devices_total": len(final_devices),
        "raw_theme_rows": len(raw_themes),
        "raw_theme_by_provenance": dict(
            Counter(p for r in raw_themes for p in r["provenance"])
        ),
        "raw_theme_unique": len({r["label_zh"] for r in raw_themes}),
        "cleanup_summary": dict(Counter(d["action"] for d in cleanup)),
        "category_distribution": library["category_distribution_themes"],
        "examples": {
            "记忆": next(t for t in final_themes if t["canonical_zh"] == "记忆"),
            "悲伤": next(t for t in final_themes if t["canonical_zh"] == "悲伤"),
            "比喻": next(d for d in final_devices if d["canonical_zh"] == "比喻"),
        },
    }
    dump(DATA / "library/build-summary.v1.json", summary)
    print(json.dumps(summary["raw_theme_by_provenance"], ensure_ascii=False, indent=2))
    print(
        "themes",
        summary["themes_total"],
        "active",
        summary["themes_active"],
        "devices",
        summary["devices_total"],
    )
    print("cleanup", summary["cleanup_summary"])


if __name__ == "__main__":
    main()
