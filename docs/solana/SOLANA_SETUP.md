# Solana Wallet Integration - Environment Variables

Add these environment variables to your `.env` file in the `app/client` directory:

```env
# Solana Configuration
VITE_SOLANA_NETWORK=devnet
VITE_TREASURY_WALLET=YOUR_TREASURY_WALLET_PUBLIC_KEY_HERE
VITE_FC_TOKEN_MINT=YOUR_FC_TOKEN_MINT_ADDRESS_HERE
VITE_FC_PER_SOL=100

# Supabase Configuration (already existing)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Variable Descriptions

### VITE_SOLANA_NETWORK
- **Type**: string
- **Options**: `devnet`, `testnet`, `mainnet-beta`
- **Description**: The Solana network to connect to
- **Example**: `devnet`

### VITE_TREASURY_WALLET
- **Type**: string (Base58 encoded public key)
- **Description**: Your treasury/platform wallet address that receives SOL payments
- **Example**: `9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin`

### VITE_FC_TOKEN_MINT
- **Type**: string (Base58 encoded public key)
- **Description**: The mint address of your FC SPL token
- **Example**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- **Note**: You need to create an SPL token on Solana for this

### VITE_FC_PER_SOL
- **Type**: number
- **Description**: Exchange rate - how many FC tokens per 1 SOL
- **Default**: `100`
- **Example**: `100` means 1 SOL = 100 FC tokens

## Creating Your FC Token (SPL Token)

To create your FC token on Solana devnet:

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Set to devnet
solana config set --url https://api.devnet.solana.com

# Create a new keypair for your treasury (if needed)
solana-keygen new -o treasury-keypair.json

# Get your public key (this is VITE_TREASURY_WALLET)
solana-keygen pubkey treasury-keypair.json

# Request airdrop (for testing on devnet)
solana airdrop 2

# Install SPL Token CLI
cargo install spl-token-cli

# Create FC token
spl-token create-token

# This will output your token mint address (VITE_FC_TOKEN_MINT)
# Create token account for treasury
spl-token create-account <YOUR_TOKEN_MINT_ADDRESS>

# Mint some initial FC tokens to your treasury
spl-token mint <YOUR_TOKEN_MINT_ADDRESS> 1000000
```

## Testing the Integration

1. Install Phantom wallet browser extension
2. Switch Phantom to devnet network
3. Create/import a test wallet in Phantom
4. Get devnet SOL: https://faucet.solana.com/
5. Connect wallet in your app using the "Connect Wallet" button
6. Try swapping SOL for FC tokens in the Wallet page

## Architecture Flow

```
User Wallet (Phantom)
    ↓ (SOL)
Treasury Wallet
    ↓ (trigger)
buy-fc-tokens Edge Function
    ↓ (update)
Supabase wallets table (balance_fc)
    ↓ (optional: on-chain)
Send FC SPL tokens to user wallet
```

## Security Notes

- Never commit `.env` files to git
- Use different wallets for devnet and mainnet
- Keep your treasury keypair secure
- The treasury wallet must have enough FC tokens minted to distribute to users
- Consider implementing rate limiting on the edge function
