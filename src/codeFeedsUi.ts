export interface CodeFeed {
  userAvatar: string;
  userName: string;
  userUrl: string;
  caption: string;
  codeSnippets: string[];
  prLink: string;
}

function buildPostHtml(feed: CodeFeed,feedIndex:number): string {

  const {userName,userAvatar,userUrl,caption,codeSnippets,prLink} = feed;

  const indicators = codeSnippets.map((_, index) => `
      <button type="button" data-bs-target="#codeCarousel${feedIndex+1}" data-bs-slide-to="${index}" class="${index === 0 ? 'active' : 'inactive'}" aria-current="${index === 0 ? 'true' : 'false'}" aria-label="Slide ${index + 1}"></button>
  `).join('');

  const carouselItems = codeSnippets.map((snippet, index) => `
      <div class="carousel-item ${index === 0 ? 'active' : ''}">
          <pre>${snippet}</pre>
          <br/><br/>
      </div>
  `).join('');



  return `<div class="post-container">
  <!-- User Info -->
  <div class="d-flex align-items-center mb-3">
    <img src="${userAvatar}" alt="User Avatar" class="user-avatar">
    <div>
      <a href="${userUrl}" target="_blank" class="username">${userName}</a>
    </div>
  </div>

  <!-- Caption -->
  <div>
    <p>${caption}</p>
  </div>

  <!-- Code Snippets Carousel -->
  <div id="codeCarousel${feedIndex+1}" class="carousel slide" data-bs-ride="carousel">
    <!-- Indicators -->
    <div class="carousel-indicators">
      ${indicators}
    </div>

    <div class="carousel-inner">
      ${carouselItems}
    </div>

    <!-- Carousel Controls -->
    <button class="carousel-control-prev" type="button" data-bs-target="#codeCarousel${feedIndex+1}" data-bs-slide="prev">
      <span class="carousel-control-prev-icon" aria-hidden="true"></span>
      <span class="visually-hidden">Previous</span>
    </button>
    <button class="carousel-control-next" type="button" data-bs-target="#codeCarousel${feedIndex+1}" data-bs-slide="next">
      <span class="carousel-control-next-icon" aria-hidden="true"></span>
      <span class="visually-hidden">Next</span>
    </button>
  </div>

  <!-- PR Link -->
  <div class="mt-3">
    <p><a href="${prLink}" target="_blank">View Pull Request</a></p>
  </div>
</div> `;

}
export function generateFeedsUi(codeFeeds: CodeFeed[],theme: string): string {
  
  const postsHtml = codeFeeds.map((feed, index) => buildPostHtml(feed, index)).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facebook Post UI - VS Code Theme</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <style>
    :root {
      --background-color: #fff;
      --text-color: #000;
      --border-color: #ddd;
      --post-background: #f8f9fa;
      --indicator-active: #555;
      --indicator-inactive: rgba(0, 0, 0, 0.5);
      --control-bg: rgba(0, 0, 0, 0.5);
    }

    body.vscode-light {
      --background-color: #fff;
      --text-color: #000;
      --border-color: #ddd;
      --post-background: #f8f9fa;
      --indicator-active: #555;
      --indicator-inactive: rgba(0, 0, 0, 0.5);
      --control-bg: rgba(0, 0, 0, 0.5);
    }

    body.vscode-dark {
      --background-color: #121212;
      --text-color: #fff;
      --border-color: #333;
      --post-background: #1e1e1e;
      --indicator-active: #ddd;
      --indicator-inactive: #555;
      --control-bg: rgba(255, 255, 255, 0.5);
    }

    body {
      background-color: var(--background-color);
      color: var(--text-color);
      transition: background-color 0.3s, color 0.3s;
    }

    .post-container {
      max-width: 600px;
      margin: 20px auto;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--background-color);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      padding: 15px;
      position: relative;
    }

    .user-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      margin-right: 10px;
    }
    .username {
      font-weight: bold;
    }
    .carousel-item pre {
      background: var(--post-background);
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
      transition: background 0.3s;
    }

    .carousel-control-prev-icon, .carousel-control-next-icon {
      background-color: var(--control-bg);
      border-radius: 50%;
      padding: 8px;
      width: 20px;
      height: 20px;
    }

    body.vscode-dark .carousel-control-prev-icon, body.vscode-dark .carousel-control-next-icon {
      background-color: transparent;
    }

    .carousel-indicators button.inactive {
      background-color: var(--indicator-inactive);
    }

    .carousel-indicators button.active {
      background-color: var(--indicator-active);
    }
  </style>
</head>
<body class="${theme}">

<div id="posts">
${postsHtml}
</div>
</body>
</html>
  `;
}