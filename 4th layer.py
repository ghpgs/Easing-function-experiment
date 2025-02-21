import requests
import json

APP_ID = "1046507532649527168"  # ご自身のアプリID


def fetch_genre(genre_id=0):
    url = "https://app.rakuten.co.jp/services/api/IchibaGenre/Search/20140222"
    params = {"applicationId": APP_ID, "genreId": genre_id}
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()


def get_nodes_at_depth(genre_id=0, target_depth=4, current_depth=1):
    """
    指定したジャンルIDから再帰的に巡回し、target_depth(例:4層目)にあるノードのみをリストとして返す
    """
    data = fetch_genre(genre_id)
    nodes = []

    # 現在のノード情報（current）を取得
    current_node = {
        "name": data.get("current", {}).get("genreName", ""),
        "id": data.get("current", {}).get("genreId", genre_id),
    }

    # もし現在の深さがtarget_depthなら、current_nodeを結果に追加
    if current_depth == target_depth:
        nodes.append(current_node)
    else:
        # target_depthに達していなければ、子ノードを探索
        children = data.get("children", [])
        for child in children:
            # 子要素が { "child": { ... } } の形の場合に対応
            if "child" in child:
                child = child["child"]
            if "genreId" not in child:
                print("childにgenreIdがありません。childの内容:", child)
                continue
            child_genre_id = child["genreId"]
            # 再帰呼び出しして、得られたリストを結合
            nodes.extend(
                get_nodes_at_depth(child_genre_id, target_depth, current_depth + 1)
            )
    return nodes


def main():
    # 4層目だけのカテゴリリストを取得
    level4_nodes = get_nodes_at_depth(0, target_depth=4, current_depth=1)
    json_output = json.dumps(level4_nodes, ensure_ascii=False, indent=2)

    # ファイルに保存
    filename = "level4_categories.json"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(json_output)

    print(f"4層目のカテゴリ情報を {filename} に保存しました。")


if __name__ == "__main__":
    main()
#     print("楽天市場の全1層目と2層目（必要なら3層目まで）のカテゴリー情報を")
#     print("rakuten_category_tree.json に保存しました。")
#     print("※ ファイルの文字コードはUTF-8です。")
