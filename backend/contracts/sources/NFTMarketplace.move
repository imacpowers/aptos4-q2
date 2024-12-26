address 0xf87c7acfed155f11fae502d5d3c2f2a8bda1c96d89cfd0252bca321fa0cc5402 {
module NFTMarketplace {
    use aptos_std::signer;
    use aptos_std::vector;
    use aptos_std::coin;
    use aptos_std::aptos_coin;
    use aptos_framework::timestamp;
    use aptos_std::simple_map;
//
    // NFT Structure
    struct NFT has store, key {
        id: u64,
        owner: address,
        name: vector<u8>,
        description: vector<u8>,
        uri: vector<u8>,
        price: u64,
        for_sale: bool,
        rarity: u8
    }

    // Listed NFT Structure
    struct ListedNFT has copy, drop {
        id: u64,
        price: u64,
        rarity: u8
    }

    // Auction Structure
    struct Auction has store, key {
        id: u64,
        nft_id: u64,
        seller: address,
        starting_price: u64,
        current_bid: u64,
        highest_bidder: address,
        end_time: u64,
        active: bool
    }

    // Marketplace Structure
    struct Marketplace has key {
        nfts: vector<NFT>,
        auctions: simple_map::SimpleMap<u64, address>, // Auction ID -> Auction Resource Address
        total_sales: u64,
        total_auctions: u64
    }

    const MARKETPLACE_FEE_PERCENT: u64 = 2;

    // Initialize Marketplace
    public entry fun initialize(account: &signer) {
        let marketplace = Marketplace {
            nfts: vector::empty<NFT>(),
            auctions: simple_map::create<u64, address>(),
            total_sales: 0,
            total_auctions: 0
        };
        move_to(account, marketplace);
    }

    #[view]
    public fun is_marketplace_initialized(marketplace_addr: address): bool {
        exists<Marketplace>(marketplace_addr)
    }

    // Mint NFT (Any User)
    public entry fun mint_nft(account: &signer, marketplace_addr: address, name: vector<u8>, description: vector<u8>, uri: vector<u8>, rarity: u8) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_id = vector::length(&marketplace.nfts);

        let new_nft = NFT {
            id: nft_id,
            owner: signer::address_of(account),
            name,
            description,
            uri,
            price: 0,
            for_sale: false,
            rarity
        };

        vector::push_back(&mut marketplace.nfts, new_nft);
    }

    // View NFT Details
    #[view]
    public fun get_nft_details(marketplace_addr: address, nft_id: u64): (u64, address, vector<u8>, vector<u8>, vector<u8>, u64, bool, u8) acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft = vector::borrow(&marketplace.nfts, nft_id);

        (nft.id, nft.owner, nft.name, nft.description, nft.uri, nft.price, nft.for_sale, nft.rarity)
    }


    // List NFT for Sale
    public entry fun list_for_sale(account: &signer, marketplace_addr: address, nft_id: u64, price: u64) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.owner == signer::address_of(account), 100);
        assert!(!nft_ref.for_sale, 101);
        assert!(price > 0, 102);

        nft_ref.for_sale = true;
        nft_ref.price = price;
    }

    // Set NFT Price
    public entry fun set_price(account: &signer, marketplace_addr: address, nft_id: u64, price: u64) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.owner == signer::address_of(account), 200);
        assert!(price > 0, 201);

        nft_ref.price = price;
    }

    // Purchase NFT
    public entry fun purchase_nft(account: &signer, marketplace_addr: address, nft_id: u64) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.for_sale, 400);
        assert!(nft_ref.price > 0, 401);
        let buyer = signer::address_of(account);
        assert!(nft_ref.owner != buyer, 402);

        let price = nft_ref.price;
        let fee = (price * MARKETPLACE_FEE_PERCENT) / 100;
        let seller_revenue = price - fee;

        coin::transfer<aptos_coin::AptosCoin>(account, nft_ref.owner, seller_revenue);
        coin::transfer<aptos_coin::AptosCoin>(account, marketplace_addr, fee);

        nft_ref.owner = buyer;
        nft_ref.for_sale = false;
        nft_ref.price = 0;
        marketplace.total_sales = marketplace.total_sales + 1;
    }

    // Check if NFT is For Sale
    #[view]
    public fun is_nft_for_sale(marketplace_addr: address, nft_id: u64): bool acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft = vector::borrow(&marketplace.nfts, nft_id);
        nft.for_sale
    }

    // Get NFT Price
    #[view]
    public fun get_nft_price(marketplace_addr: address, nft_id: u64): u64 acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft = vector::borrow(&marketplace.nfts, nft_id);
        nft.price
    }

    // Transfer NFT Ownership
    public entry fun transfer_ownership(account: &signer, marketplace_addr: address, nft_id: u64, new_owner: address) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.owner == signer::address_of(account), 300);
        assert!(nft_ref.owner != new_owner, 301);

        nft_ref.owner = new_owner;
        nft_ref.for_sale = false;
        nft_ref.price = 0;
    }

    // Start an Auction
    public entry fun start_auction(account: &signer, marketplace_addr: address, nft_id: u64, starting_price: u64, duration: u64) acquires Marketplace {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

        assert!(nft_ref.owner == signer::address_of(account), 100);
        assert!(!nft_ref.for_sale, 101);

        let auction_id = marketplace.total_auctions;
        let auction = Auction {
            id: auction_id,
            nft_id,
            seller: signer::address_of(account),
            starting_price,
            current_bid: 0,
            highest_bidder: signer::address_of(account),
            end_time: timestamp::now_seconds() + duration,
            active: true
        };

        marketplace.total_auctions = marketplace.total_auctions + 1;
        move_to(account, auction);
        simple_map::add(&mut marketplace.auctions, auction_id, signer::address_of(account));
    }

    // Place a Bid
    public entry fun place_bid(account: &signer, marketplace_addr:address, auction_id: u64, bid_amount: u64) acquires Marketplace, Auction {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let auction_address = *simple_map::borrow(&marketplace.auctions, &auction_id);
        let auction_ref = borrow_global_mut<Auction>(auction_address);

        assert!(auction_ref.active, 200);
        assert!(timestamp::now_seconds() < auction_ref.end_time, 201);
        assert!(bid_amount > auction_ref.current_bid, 202);

        auction_ref.current_bid = bid_amount;
        auction_ref.highest_bidder = signer::address_of(account);
    }

    // End an Auction
    public entry fun end_auction(account: &signer, marketplace_addr: address, auction_id: u64) acquires Marketplace, Auction {
        let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
        let auction_address = *simple_map::borrow(&marketplace.auctions, &auction_id);
        let auction_ref = borrow_global_mut<Auction>(auction_address);

        assert!(auction_ref.active, 300);
        assert!(timestamp::now_seconds() >= auction_ref.end_time, 301);

        let nft_ref = vector::borrow_mut(&mut marketplace.nfts, auction_ref.nft_id);
        nft_ref.owner = auction_ref.highest_bidder;
        nft_ref.for_sale = false;
        nft_ref.price = auction_ref.current_bid;

        let fee = (auction_ref.current_bid * MARKETPLACE_FEE_PERCENT) / 100;
        let seller_revenue = auction_ref.current_bid - fee;

        coin::transfer<aptos_coin::AptosCoin>(account, marketplace_addr, fee);
        coin::transfer<aptos_coin::AptosCoin>(account, auction_ref.seller, seller_revenue);

        auction_ref.active = false;
        marketplace.total_sales = marketplace.total_sales + 1;
    }

    // Analytics Functions
    #[view]
    public fun get_total_nfts(marketplace_addr: address): u64 acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        vector::length(&marketplace.nfts)
    }

    #[view]
    public fun get_total_sales(marketplace_addr: address): u64 acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        marketplace.total_sales
    }

    #[view]
    public fun get_total_auctions(marketplace_addr: address): u64 acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        marketplace.total_auctions
    }

    // Retrieve NFTs owned by a specific address (with pagination)
    #[view]
    public fun get_all_nfts_for_owner(marketplace_addr: address, owner_addr: address, limit: u64, offset: u64): vector<u64> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft_ids = vector::empty<u64>();

        let nfts_len = vector::length(&marketplace.nfts);
        let end = min(offset + limit, nfts_len);
        let mut_i = offset;
        while (mut_i < end) {
            let nft = vector::borrow(&marketplace.nfts, mut_i);
            if (nft.owner == owner_addr) {
                vector::push_back(&mut nft_ids, nft.id);
            };
            mut_i = mut_i + 1;
        };

        nft_ids
    }

    // Retrieve NFTs that are for sale (with pagination)
    #[view]
    public fun get_all_nfts_for_sale(marketplace_addr: address, limit: u64, offset: u64): vector<ListedNFT> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nfts_for_sale = vector::empty<ListedNFT>();

        let nfts_len = vector::length(&marketplace.nfts);
        let end = min(offset + limit, nfts_len);
        let mut_i = offset;
        while (mut_i < end) {
            let nft = vector::borrow(&marketplace.nfts, mut_i);
            if (nft.for_sale) {
                let listed_nft = ListedNFT { id: nft.id, price: nft.price, rarity: nft.rarity };
                vector::push_back(&mut nfts_for_sale, listed_nft);
            };
            mut_i = mut_i + 1;
        };

        nfts_for_sale
    }

    // Retrieve NFTs by rarity
    #[view]
    public fun get_nfts_by_rarity(marketplace_addr: address, rarity: u8): vector<u64> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(marketplace_addr);
        let nft_ids = vector::empty<u64>();

        let nfts_len = vector::length(&marketplace.nfts);
        let mut_i = 0;
        while (mut_i < nfts_len) {
            let nft = vector::borrow(&marketplace.nfts, mut_i);
            if (nft.rarity == rarity) {
                vector::push_back(&mut nft_ids, nft.id);
            };
            mut_i = mut_i + 1;
        };

        nft_ids
    }

    // Helper function to find the minimum of two u64 numbers
    public fun min(a: u64, b: u64): u64 {
        if (a < b) { a } else { b }
    }
}
}