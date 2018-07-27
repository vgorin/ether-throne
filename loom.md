1. Prerequisites
   ```
   brew install wget --with-libressl
   brew install golang
   brew install protobuf
   brew install dep
   ```

2. Loom Binary
   ```
   wget https://private.delegatecall.com/loom/osx/build-288/loom
   chmod +x loom
   ```

3. Keypair
   ```
   ./loom genkey -k priv_key -a pub_key
   ```

4. Build Blueprint
   ```
   mkdir tmpgopath
   export GOPATH=`pwd`/tmpgopath
   ./loom spin weave-blueprint
   cd blueprint
   export GOPATH=$GOPATH:`pwd`
   make deps
   make
   cd build
   ```

5. Loom Init, Genesis
   ```
   ../../loom init
   cp ../genesis.example.json genesis.json
   ```

6. Run
   ```
   ../../loom run
   ```
