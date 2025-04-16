import requests
import json

APP_ID = "1046507532649527168"


def get_genre(genre_id):
    """
    指定した genreId のジャンル情報を楽天APIから取得する関数
    """
    url = "https://app.rakuten.co.jp/services/api/IchibaGenre/Search/20140222"
    params = {"applicationId": APP_ID, "genreId": str(genre_id), "format": "json"}
    response = requests.get(url, params=params)
    return response.json()


def transform_node(genre_id, current_depth, max_depth):
    """
    指定した genre_id の情報を再帰的に取得し、
    以下の形式に変換して返す関数:
      { "name": <カテゴリ名>, "subcategories": [ ... ] }
    current_depth が max_depth 未満なら子カテゴリも取得する
    """
    data = get_genre(genre_id)
    # APIレスポンスの "current" キーに対象カテゴリの情報が入っている
    current = data.get("current", {})
    node = {"name": current.get("genreName", ""), "subcategories": []}

    # max_depth に達していなければ子カテゴリを再帰的に処理
    if current_depth < max_depth:
        children = data.get("children", [])
        for child_item in children:
            # 各子は "child" キーに詳細情報がある
            child_data = child_item.get("child", {})
            child_genre_id = child_data.get("genreId")
            # 再帰呼び出しで子ノードを作成
            node["subcategories"].append(
                transform_node(child_genre_id, current_depth + 1, max_depth)
            )
    return node


def build_category_tree(max_depth):
    """
    楽天APIのトップレベル（genreId "0"）から、
    すべての1層目とそれぞれの子（2層目～max_depth層目）のツリーを作成し、
    指定の形式 { "categories": [ ... ] } に整形して返す
    """
    top_data = get_genre("0")
    top_children = top_data.get("children", [])
    categories = []
    for item in top_children:
        child_data = item.get("child", {})
        genre_id = child_data.get("genreId")
        # 1層目は current_depth=1
        node = transform_node(genre_id, current_depth=1, max_depth=max_depth)
        categories.append(node)
    return {"categories": categories}


if __name__ == "__main__":
    # サンプルでは max_depth=3 として、1層目＋2層目＋3層目を取得する例
    # ※ 指定のサンプルJSONは3層目までネストしている
    tree = build_category_tree(max_depth=5)
    # 結果をファイルに整形済みJSONとして保存
    with open("rakuten_category_tree.json", "w", encoding="utf-8") as f:
        json.dump(tree, f, ensure_ascii=False, indent=2)
    print("楽天市場の全1層目と2層目（必要なら3層目まで）のカテゴリー情報を")
    print(" 'rakuten_category_tree.json' に保存しました")
