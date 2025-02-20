import requests
import json

# 楽天デベロッパーAPIのアプリID
APP_ID = "1046507532649527168"


def get_genre(genre_id):
    """
    指定した genreId のジャンル情報を楽天APIから取得する関数
    """
    url = "https://app.rakuten.co.jp/services/api/IchibaGenre/Search/20140222"
    params = {"applicationId": APP_ID, "genreId": str(genre_id), "format": "json"}
    response = requests.get(url, params=params)
    return response.json()


def get_top_genres():
    """
    トップレベル（1層目）のカテゴリー情報を取得する関数
    genreIdに"0"を指定することで、全1層目のカテゴリーが返ってくる
    """
    data = get_genre("0")
    return data.get("children", [])


def get_top_and_second_layer():
    """
    1層目と2層目のカテゴリー情報を取得して、指定の形式に整形する関数
    結果の形式は以下のJSON形式:
    {
      "categories": [
        {
          "name": "トップカテゴリー名",
          "subcategories": [
            { "genreId": 子カテゴリーのID, "genreName": "子カテゴリー名" },
            ...
          ]
        },
        ...
      ]
    }
    """
    top_genres = get_top_genres()
    result = {"categories": []}
    for item in top_genres:
        if isinstance(item, dict):
            child = item.get("child", {})
            top_id = child.get("genreId")
            top_name = child.get("genreName")
            # 各トップカテゴリーの2層目の情報を取得
            second_data = get_genre(top_id)
            second_items = second_data.get("children", [])
            subcategories = []
            for second in second_items:
                if isinstance(second, dict):
                    second_child = second.get("child", {})
                    subcategories.append(
                        {
                            "genreId": second_child.get("genreId"),
                            "genreName": second_child.get("genreName"),
                        }
                    )
            result["categories"].append(
                {"name": top_name, "subcategories": subcategories}
            )
    return result


if __name__ == "__main__":
    # 1層目と2層目のカテゴリー情報を取得
    data = get_top_and_second_layer()
    # JSONファイルに保存（省略なしで完全な情報を出力）
    with open("rakuten_categories.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(
        "全ての1層目と2層目のカテゴリー情報を 'rakuten_categories.json' に保存しました♪"
    )
