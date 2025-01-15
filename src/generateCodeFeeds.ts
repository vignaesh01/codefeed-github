import * as vscode from 'vscode';
import * as path from 'path';
import axios from 'axios';
import {CodeFeed,generateFeedsUi} from './codeFeedsUi';



export class CodeFeedsProvider implements vscode.TreeDataProvider<Repository> {

	private _onDidChangeTreeData: vscode.EventEmitter<Repository | undefined | void> = new vscode.EventEmitter<Repository | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Repository | undefined | void> = this._onDidChangeTreeData.event;
	private _context: vscode.ExtensionContext;
	private _gitHubPat: string | undefined;
	private _panel: vscode.WebviewPanel | undefined;
	private _MODEL_PROMPT=`
You are an AI assistant that generates trendy, catchy, witty, and humorous Instagram-style captions inspired by code changes in Pull Requests, 
from the perspective of the developer who made the changes. Captions must not exceed 250 characters.
Analyze the Pull Request to identify up to 5 important, interesting, or impactful blocks of code as snippets. 
Each code snippet can include 1 or more lines of code, but in cases where there are changes spanning multiple lines, return 5-6 lines per snippet to help convey the gist of the changes. 
Provide the result in a valid JSON format without wrapping the result in \`\`\`json\`\`\` or any other code block markers. It should have the following structure

{
"caption": "Generated caption here, reflecting the developer's point of view.",
"codesnippets": [
"Code snippet 1 with 1 or more lines providing context.",
"Code snippet 2 with 1 or more lines providing context.",
"...",
"Code snippet n with 1 or more lines providing context"
]
	`;
		
	constructor(private context: vscode.ExtensionContext) {
		this._context = context;
		this._panel = vscode.window.createWebviewPanel(
			'codeFeeds',
			'Code Feeds',
			vscode.ViewColumn.One,
			{
				// Enable scripts in the webview
				enableScripts: true
			}
		);
		this._panel.onDidDispose(() => {
			this._panel = undefined;
		});
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Repository): vscode.TreeItem {
		return element;
	}

	async getChildren(element: Repository): Promise<Repository[]> {
			if(element){
				return Promise.resolve([]);
			}
			this._gitHubPat = await this.getGitHubPat();
			if(!this._gitHubPat || this._gitHubPat === "") {
				vscode.window.showErrorMessage("GitHub Personal Access Token is required to fetch the repositories.");
				return Promise.resolve([]);
			}	
			return await this.getStarredRepos();
	
	}

	//function to prompt for GitHub PAT if it not present and store it in context.secrets. If the PAT is present return the PAT string
	private async getGitHubPat(): Promise<string|undefined> {
		let gitHubPat: string|undefined = await this._context.secrets.get("gitHubPat");
		if (!gitHubPat) {
			gitHubPat = await vscode.window.showInputBox({
				placeHolder: "Enter your GitHub Personal Access Token",
				prompt: "A GitHub Personal Access Token is required to fetch the repositories.",
				ignoreFocusOut: true,
				password: true
			});
			if (gitHubPat) {
				await this._context.secrets.store("gitHubPat", gitHubPat);
			}
		}
		return gitHubPat;
	}

	//function to clear the GitHub PAT from context.secrets
	async clearGitHubToken() {
		await this._context.secrets.delete("gitHubPat");
		vscode.window.showInformationMessage("GitHub Personal Access Token has been cleared.");
	}
	//function to fetch starred repositories from GitHub using axios the GitHub PAT and return the Repository[] to be used in Tree View
	private async getStarredRepos(): Promise<Repository[]> {
		
		const repos=await this.paginateGitHubApi('https://api.github.com/user/starred');
		const repositories: Repository[] = [];
		for (const repo of repos) {
			repositories.push(new Repository(repo.full_name, repo.description, vscode.TreeItemCollapsibleState.None, {
				command: 'codeFeeds.showCodeFeeds',
				title: '',
				arguments: [repo.url]
			}));
		}
		return repositories;
	}

	//async function to paginate GitHub APIs and fetch all results
	private async paginateGitHubApi(url: string): Promise<any[]> {
		const data: any[] = [];
		let response = await this.fetchGitHubApi(url);
		//data = data.concat(response.data);
		data.push(...response.data);
		while (response.headers.link) {
			//console.log("Next page exists");
			const nextUrl = this.extractNextLink(response.headers.link);
			if (nextUrl) {
				response = await this.fetchGitHubApi(nextUrl);
				data.push(...response.data);
			} else {
				break;
			}
		}
		return data;
	}

	private async fetchGitHubApi(url: string): Promise<any> {
		return axios.get(url, {
			headers: {
				'Authorization': `Bearer ${this._gitHubPat}`,
				'Accept': 'application/vnd.github.v3+json',
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
	}

	private extractNextLink(linkHeader: string): string | null {
		const links = linkHeader.split(',');
		const nextLink = links.find((link: string) => link.includes('rel="next"'));
		return nextLink ? nextLink.match(/<(.*)>/)![1] : null;
	}

async showCodeFeeds(repoApiUrl: string) {
	try {
		
		const pullRequests = await this.getPullRequests(repoApiUrl);
		const codeFeeds:CodeFeed[]=[];
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Generating Code Feeds...",
			cancellable: false
		}, async (_progress) => {
			for (const pr of pullRequests) {
				const fileChanges = await this.getPullRequestFileChanges(pr.url);
				const pullRequestChangesPromptMessage = this.buildPullRequestChangesPrompt(pr, fileChanges);
				console.log(pullRequestChangesPromptMessage);
				const prFeed = await this.getPRFeedFromLLM(pullRequestChangesPromptMessage);
				//check whether prFeed is a valid JSON
				let prFeedJson;
				try {
					prFeedJson = JSON.parse(prFeed);
				} catch (error) {
					console.log("Failed to parse PR feed JSON: " + (error as any).message);
					continue;
				}
				
				const codeFeedObj: CodeFeed = {
					userAvatar: pr.user.avatar_url,
					userName: pr.user.login,
					userUrl: pr.user.html_url,
					caption: prFeedJson.caption,
					codeSnippets: prFeedJson.codesnippets,
					prLink: pr.html_url
				};
				codeFeeds.push(codeFeedObj);
			}
			this.showCodeFeedsinPanel(codeFeeds);
		});

		
	} catch (error) {
		const errorMessage = (error as any).message || 'Unknown error';
		vscode.window.showErrorMessage(`Failed to showCodeFeeds: ${errorMessage}`);
	}
}

	private showCodeFeedsinPanel(codeFeeds: CodeFeed[]) {
		if (!this._panel) {
			this._panel = vscode.window.createWebviewPanel(
				'codeFeeds',
				'Code Feeds',
				vscode.ViewColumn.One,
				{// Enable scripts in the webview
				enableScripts: true
				}
			);
			this._panel.onDidDispose(() => {
				this._panel = undefined;
			});
		} else {
			this._panel.reveal(vscode.ViewColumn.One);
		}
		const panel = this._panel;
		//get the current active theme in vs code light or dark
		const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'vscode-dark' : 'vscode-light';
		panel.webview.html = generateFeedsUi(codeFeeds,theme);
	}

	async getPullRequests(repoApiUrl: string): Promise<any> {
		console.log("getPullRequests invoked");
		const response = await axios.get(`${repoApiUrl}/pulls?state=closed&per_page=10`, {
			headers: {
				'Authorization': `Bearer ${this._gitHubPat}`,
				'Accept': 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
		return response.data;
	}

	async getPullRequestFileChanges(pullRequestUrl: string): Promise<any> {
		console.log("getPullRequestFileChanges invoked");
		const response = await axios.get(`${pullRequestUrl}/files`, {
			headers: {
				'Authorization': `Bearer ${this._gitHubPat}`,
				'Accept': 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
		return response.data;
	}

	buildPullRequestChangesPrompt(pr: any, fileChanges: any): string {
		//iterate fileChanges and build the prompt message which inclues pr tilte, pr body ,filename and patch
		console.log("buildPullRequestChangesPrompt invoked");
		let promptMessage = `${pr.title}\n${pr.body}\n\nFile Changes:\n`;
		for (const fileChange of fileChanges) {
			promptMessage += `Filename: ${fileChange.filename}\n`;
			if(fileChange.patch){
				promptMessage += 'Code: ```'+fileChange.patch+'```\n';
			}
			
		}
		return promptMessage;
	}

	async getPRFeedFromLLM(pullRequestChangesPromptMessage: string): Promise<string> {
		//fetch the PR feed from LLM using the pullRequestChangesPromptMessage
		console.log("getPRFeedFromLLM");
		const craftedPrompt=[
			vscode.LanguageModelChatMessage.User(this._MODEL_PROMPT),
			vscode.LanguageModelChatMessage.User(pullRequestChangesPromptMessage)
		];

		try {
			const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
			const chatResponse: vscode.LanguageModelChatResponse = await model.sendRequest(craftedPrompt, {}, new vscode.CancellationTokenSource().token);
			let completeResponse = '';
			for await (const fragment of chatResponse.text) {
				completeResponse += fragment;
			}
			console.log(completeResponse);
			return completeResponse;
		  } catch (err) {
			// Making the chat request might fail because
			// - model does not exist
			// - user consent not given
			// - quota limits were exceeded
			if (err instanceof vscode.LanguageModelError) {
			  console.log(err.message, err.code);
			  /*if (err.cause instanceof Error && err.cause.message.includes('off_topic')) {
				stream.markdown(
				  vscode.l10n.t("I'm sorry, I can only explain computer science concepts.")
				);
			}*/
			} else {
			  // add other error handling logic
			  console.log(err);
			  //throw err;
			}
		  }
		return "PR feed from LLM";
	}

}

export class Repository extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		private readonly version: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);

		//this.tooltip = `${this.label}-${this.version}`;
		this.tooltip = `Click to show code feeds for ${this.label}`;
		this.description = this.version;
	}

	iconPath = {
		light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'light', 'folder.svg')),
		dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'dark', 'folder.svg'))
	};

	contextValue = 'codeFeeds';
}
