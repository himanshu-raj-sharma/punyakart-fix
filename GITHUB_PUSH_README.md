# Push this Punyakart package to GitHub

The intended destination is `https://github.com/himanshu-raj-sharma/punyakart-fix`.

1. Extract this archive.
2. Open PowerShell in the extracted `punyakart` folder.
3. Run `./Push-To-GitHub.ps1`.
4. When prompted, sign into GitHub through Git Credential Manager; do not paste a token into the script or commit one into the repository.
5. Verify the repository page after the script reports success.

The script refuses to push real `.env` files and private-key/certificate files, and it never force-pushes. The archive intentionally excludes `.git`, `node_modules`, `.opencode`, and generated `dist` output. Install dependencies and build separately with Node.js 20+ before deployment.
