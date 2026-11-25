{
  description = "Nodi development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: lib.genAttrs systems (system: f system);
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            name = "nodi";

            packages = with pkgs; [
              nodejs_24
              pnpm
              cargo
              clippy
              kache
              rustc
              rustfmt
              pkg-config
            ];

            buildInputs = lib.optionals pkgs.stdenv.hostPlatform.isLinux (with pkgs; [
              dbus
              gtk3
              librsvg
              openssl
              webkitgtk_4_1
            ]);

            RUSTC_WRAPPER = "${pkgs.kache}/bin/kache";

            shellHook = ''
              echo "Nodi dev shell — node $(node --version), pnpm $(pnpm --version), rustc $(rustc --version)"
            '';
          };
        });
    };
}
