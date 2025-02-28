import json


def flatten_tree(data, level=1):
    """各カテゴリの階層ごとの要素数を集計"""
    counts = {level: len(data)}
    for item in data:
        if "subcategories" in item:
            deeper_counts = flatten_tree(item["subcategories"], level + 1)
            for k, v in deeper_counts.items():
                counts[k] = counts.get(k, 0) + v
    return counts


def trim_tree(data, max_subcategories=5):
    """カテゴリが多すぎる場合に整理する（例: 最大5個まで）"""
    for item in data:
        if "subcategories" in item:
            item["subcategories"] = item["subcategories"][
                :max_subcategories
            ]  # 上位5カテゴリのみ
            trim_tree(item["subcategories"], max_subcategories)
    return data


# JSONを読み込み
with open("rakuten_category_filtered.json", "r", encoding="utf-8") as f:
    json_data = json.load(f)

# 階層ごとのカテゴリ数を出力
category_counts = flatten_tree(json_data["categories"])
print("カテゴリ構成:", category_counts)

# カテゴリの整理
json_data["categories"] = trim_tree(json_data["categories"], max_subcategories=5)

# 整形後のJSONを書き出し
with open("cleaned_data.json", "w", encoding="utf-8") as f:
    json.dump(json_data, f, ensure_ascii=False, indent=2)
