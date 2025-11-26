{
  description = "hardcover pdf sync - firefox extension";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # node.js and package managers
            nodejs_22
            nodePackages.npm

            # build
            typescript

            # browser extension development
            web-ext

            # linting and formatting
            nodePackages.eslint
            nodePackages.prettier
          ];

          shellHook = ''
            		  export SHELL=/run/current-system/sw/bin/zsh
            exec /run/current-system/sw/bin/zsh

                    echo "goodreads pdf progress tracker dev environment"
                    echo "=============================================="
                    echo "node version: $(node --version)"
                    echo "npm version: $(npm --version)"
                    echo ""
                    echo "available commands:"
                    echo "  npm install        - install dependencies"
                    echo "  npm run dev        - start development mode"
                    echo "  npm run build      - build extension"
                    echo "  npm run lint       - lint code"
                    echo "  web-ext run        - run extension in firefox"
                    echo ""

                    # create node_modules if it doesn't exist
                    if [ ! -d "node_modules" ]; then
                      echo "installing dependencies..."
                      npm install
                    fi
          '';
        };
      }
    );
}
