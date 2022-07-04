name: Build and test

on: [push]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Use Node.js 14.x
        uses: actions/setup-node@v1
        with:
          node-version: 14.x

      - name: Prepare
        run: |
          cd src
          npm install
          npm run build
          npm run test
          cd dist
          npm link
          cd ..
          cd ..
          npm install -g @angular/cli@next
          ng new your-angular-project --defaults
          cd your-angular-project
          npm link angular-cli-ghpages
          ng add angular-cli-ghpages

      - name: Deploy
        if: github.ref == 'refs/heads/master'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cd your-angular-project
          ng deploy --no-silent --name="The Buildbot" --email="buildbot@angular2buch.de" --cname=angular-cli-ghpages.angular.schule
