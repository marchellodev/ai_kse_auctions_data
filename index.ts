import { readdir } from "node:fs/promises";
import path from "node:path";
import { stringify } from "csv-stringify/sync";

const folder = "kse_meeting_auction";

const postsToSkip = [
  "2024-02-20_11-46-48_UTC",
  "2024-02-23_10-10-00_UTC",
  "2024-02-12_11-53-41_UTC_profile_pic",
];

async function main() {
  const files = await readdir(folder);

  let posts = [];
  let comments = [];
  let commenters = [];

  for (const fileFull of files) {
    if (!fileFull.endsWith(".txt")) continue;

    const file = fileFull.split(".")[0];

    if (postsToSkip.includes(file)) continue;

    const postText = await Bun.file(path.join(folder, `${file}.txt`)).text();
    const postMeta = await Bun.file(path.join(folder, `${file}.json`)).json();

    const imagePath = `https://raw.githubusercontent.com/marchellodev/ai_kse_auctions_data/main/kse_meeting_auction/${file}.jpg`;

    const date = [
      file.split("_")[0],
      file.split("_")[1].replaceAll("-", ":"),
      file.split("_")[2],
    ].join(" ");

    const n = parseEmojiNumber(postText.substring(1, 6).split(" ")[0]);

    posts.push({
      n: n,
      date: new Date(date),
      image: imagePath,
      text: postText,

      post_id: postMeta.node.id,
      post_image_height: postMeta.node.dimensions.height,
      post_image_width: postMeta.node.dimensions.width,
      post_image_date: new Date(postMeta.node.taken_at_timestamp * 1000),

      post_a11y_caption: postMeta.node.accessibility_caption,
      post_comments: postMeta.node.edge_media_to_comment.count,

      post_location_id: postMeta.node.location?.id ?? null,
      post_location_name: postMeta.node.location?.name ?? null,
      post_location: postMeta.node.location?.address_json ?? null,
      post_text_edited: postMeta.node.caption_is_edited ?? null,
    });

    const commentParsing = await parseComments(
      path.join(folder, `${file}_comments.json`),
      n,
    );

    comments.push(...commentParsing.comments);
    commenters.push(...commentParsing.owners);
  }

  posts = posts.sort((a, b) => a.n - b.n);
  comments = comments.sort((a, b) => a.post_n - b.post_n);

  await Bun.write(
    "result_posts.csv",
    stringify(posts, {
      header: true,
    }),
  );

  await Bun.write(
    "result_comments.csv",
    stringify(comments, {
      header: true,
    }),
  );

  await Bun.write(
    "result_commenters.csv",
    stringify(commenters, {
      header: true,
    }),
  );

  console.log(
    "Done! Check `result_posts.csv`, `result_comments.csv`,  `result_commenters.csv`",
  );
}

function parseEmojiNumber(str: string) {
  if (str == "🔟") return 10;

  return parseInt(str.replace(/\D/g, ""), 10);
}

async function parseComments(file: string, n: number) {
  const postComments = await Bun.file(file).json();

  const comments: Record<string, string | Date | number | null>[] = [];
  const owners: Record<string, string>[] = [];

  for (const comment of postComments) {
    comments.push({
      post_n: n,
      id: comment.id,
      owner_id: comment.owner.id,
      answer_to: null,
      text: comment.text,
      likes_count: comment.likes_count,
      created_at: new Date(comment.created_at * 1000),
    });

    if (!owners.find((el) => el.id === comment.owner.id)) {
      owners.push({
        id: comment.owner.id,
        username: comment.owner.username,
        is_verified: comment.owner.is_verified,
        profile_pic: comment.owner.profile_pic_url,
      });
    }

    for (const answer of comment.answers) {
      comments.push({
        post_n: n,
        id: answer.id,
        answer_to: comment.id,
        text: answer.text,
        likes_count: answer.likes_count,
        created_at: new Date(answer.created_at * 1000),
      });

      if (!owners.find((el) => el.id === answer.owner.id)) {
        owners.push({
          id: answer.owner.id,
          username: answer.owner.username,
          is_verified: answer.owner.is_verified,
          profile_pic: answer.owner.profile_pic_url,
        });
      }
    }
    return { comments, owners };
  }
  console.log(comments);
  process.exit(0);
}

await main();
