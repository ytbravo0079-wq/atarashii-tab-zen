import type { ConfigState } from "../stores/ConfigStore"
import type { RedditPost } from "../stores/HistoryStore"

type RedditSearchResponse = {
  data: {
    after: string | null
    children: Array<{
      data: RedditPost & {
        thumbnail?: string
        over_18?: boolean
        link_flair_text?: string
      }
    }>
  }
}

export async function fetchPosts(config: ConfigState) {
  let posts: Array<RedditPost & { thumbnail?: string; over_18?: boolean }> = []

  const subreddits = config.nsfw
    ? "Animewallpaper+ecchi+hentaiwallpapers"
    : "Animewallpaper+moescape+Anime_Wallpapers+wallpaper+wallpapers"

  const sort = config.sort ? config.sort.toString() : "hot"
  const t = config.t ? config.t.toString() : "all"
  const nsfwParam = config.nsfw ? "&include_over_18=1" : ""

  // Track pagination cursor in localStorage so it never runs out
  const afterKey = `reddit_after_${config.nsfw ? "nsfw" : "sfw"}_${sort}`
  let after = localStorage.getItem(afterKey) || ""

  let url = `https://www.reddit.com/r/${subreddits}/${sort}.json?limit=50&t=${t}${nsfwParam}`
  if (after) {
    url += `&after=${after}`
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      // If the cursor expires or errors, reset it to start fresh
      localStorage.removeItem(afterKey)
      return posts
    }

    const json = (await res.json()) as RedditSearchResponse
    if (!json.data || !json.data.children) return posts

    // Save the next cursor for future rerolls
    if (json.data.after) {
      localStorage.setItem(afterKey, json.data.after)
    } else {
      localStorage.removeItem(afterKey)
    }

    const validPosts = json.data.children
      .map((child) => child.data)
      .filter((post) => {
        return (
          post.url &&
          (post.url.includes("i.redd.it") ||
            post.url.includes("i.imgur.com") ||
            post.url.endsWith(".jpg") ||
            post.url.endsWith(".png"))
        )
      })

    if (config.nsfw) {
      posts = validPosts.filter(
        (e) =>
          e.over_18 === true ||
          e.thumbnail === "nsfw" ||
          (e.link_flair_text && e.link_flair_text.toLowerCase().includes("nsfw"))
      )
      if (posts.length === 0) posts = validPosts
    } else {
      posts = validPosts.filter(
        (e) =>
          !e.over_18 &&
          e.thumbnail !== "nsfw" &&
          !(e.link_flair_text && e.link_flair_text.toLowerCase().includes("nsfw"))
      )
    }

    // Shuffle the current batch
    posts.sort(() => Math.random() - 0.5)
  } catch (err) {
    console.error("Fetch error:", err)
  }

  return posts
}
