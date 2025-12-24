use anchor_lang::prelude::*;

declare_id!("A44iQK5oFoZDpbDUn3gturKbPWNtEax3x6RBARxPcUGk");

#[program]
pub mod blockchain {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
