import React, { useReducer, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/router";
import { ParsedAccountData, PublicKey, Transaction } from "@solana/web3.js";
import { CopyToClipboard } from "../components/copy-to-clipboard";

import { useModal } from "../contexts/ModalProvider";
import { useAlert } from "../contexts/AlertProvider";
import Head from "next/head";
import { fetchMetaForUI } from "../util/token-metadata";
import {
  createBurnInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { toPublicKey } from "../util/to-publickey";
import { NFTPreview } from "../components/nft-preview";
import { getBlockhashWithRetries } from "../util/get-blockhash-with-retries";
import { FireIcon, LeftIcon, RightIcon } from "../components/icons";
const initState: {
  nfts: any[];
  status: string;
  publicAddress: null | string;
  itemsPerPage: 12 | 24 | 120;
  isModalOpen: boolean;
  isBurning: boolean;
  selectedNFTs: PublicKey[];
} = {
  nfts: [],
  publicAddress: null,
  status: "idle",
  itemsPerPage: 12,
  isModalOpen: false,
  isBurning: false,
  selectedNFTs: [],
};

type BurnNftAction =
  | { type: "started"; payload?: null }
  | { type: "error"; payload?: null }
  | { type: "unselectAll"; payload?: null }
  | { type: "burning"; payload?: null }
  | { type: "burned"; payload?: null }
  | { type: "success"; payload: { nfts: any[] } }
  | { type: "nfts"; payload: { nfts: any[] } }
  | { type: "isModalOpen"; payload: { isModalOpen: boolean } }
  | { type: "publicAddress"; payload: { publicAddress: string } }
  | { type: "itemsPerPage"; payload: { itemsPerPage: number } }
  | { type: "selectedNFTs"; payload: { selectedNFTs: PublicKey[] } };

const reducer = (state: typeof initState, action: BurnNftAction) => {
  switch (action.type) {
    case "started":
      return { ...state, status: "pending" };
    case "nfts":
      return { ...state, nfts: action.payload.nfts };
    case "burning":
      return { ...state, isBurning: true };
    case "burned":
      return { ...state, isBurning: false };
    case "error":
      return { ...state, status: "rejected" };
    case "itemsPerPage":
      return { ...state, itemsPerPage: action.payload.itemsPerPage };
    case "isModalOpen":
      return { ...state, isModalOpen: action.payload.isModalOpen };
    case "publicAddress":
      return { ...state, publicAddress: action.payload.publicAddress };
    case "success":
      return { ...state, status: "resolved", nfts: action.payload.nfts };
    case "unselectAll":
      return { ...state, selectedNFTs: [] };
    case "selectedNFTs":
      return {
        ...state,
        selectedNFTs: action.payload.selectedNFTs,
      };
    default:
      throw new Error("unsupported action type given on BurnNFTs reducer");
  }
};

export default function BurnNFTs() {
  const { setModalState } = useModal();
  const { setAlertState } = useAlert();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const router = useRouter();

  const [state, dispatch] = useReducer(reducer, initState);

  const pubKeyString = useMemo(() => publicKey?.toBase58(), [publicKey]);

  const handleNFTs = useCallback(async () => {
    if (!publicKey) {
      return;
    }

    try {
      dispatch({ type: "started" });
      dispatch({
        type: "publicAddress",
        payload: { publicAddress: pubKeyString },
      });
      const accounts = await connection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID, // new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        {
          filters: [
            {
              dataSize: 165, // number of bytes
            },
            {
              memcmp: {
                offset: 32, // number of bytes
                bytes: pubKeyString, // base58 encoded string
              },
            },
          ],
        }
      );
      const mints = accounts
        .filter(
          (a) =>
            (a.account.data as ParsedAccountData).parsed.info.tokenAmount
              .uiAmount
        )
        .map((a) => (a.account.data as ParsedAccountData).parsed.info.mint);
      const data = (
        await fetchMetaForUI(mints, () => {}, connection).toPromise()
      ).filter((e) => !e.failed);

      const nftsWithImages = data.map((nft) => {
        if (nft) {
          if (nft.metadata?.image) {
            return { ...nft, image: nft.metadata?.image };
          } else if (nft.metadata?.properties?.category === "video") {
            return {
              ...nft,
              image: null,
              video: { ...nft?.metadata?.properties?.files[0] },
            };
          } else return { ...nft, image: null, video: null };
        } else return { ...nft, image: null, video: null };
      });
      dispatch({ type: "success", payload: { nfts: nftsWithImages } });
    } catch (err) {
      console.log(err);
      dispatch({ type: "error" });
    }
  }, [publicKey, dispatch, connection]);

  const itemsPerPage = useMemo(() => state.itemsPerPage, [state]);

  const page = useMemo(() => {
    return Number(router.query.page) || 1;
  }, [router.query]);

  const nftsToRender = useMemo(() => {
    if (!state.nfts) {
      return [];
    }

    const nftsCopy = [...state.nfts];
    const chunkedNFTs = [];
    const firstChunk = nftsCopy.splice(0, itemsPerPage);
    chunkedNFTs.push(firstChunk);
    while (nftsCopy.length) {
      const chunk = nftsCopy.splice(0, itemsPerPage);
      chunkedNFTs.push(chunk);
    }
    return chunkedNFTs[page - 1];
  }, [state, page, itemsPerPage]);

  const handleNextPage = useCallback(() => {
    router.replace({
      pathname: router.pathname,
      query: { ...router.query, page: page + 1 },
    });
  }, [page, router]);

  const handlePrevPage = useCallback(() => {
    if (page - 1 === 1) {
      const newQuery = { ...router.query };
      delete newQuery.page;
      router.replace({ pathname: router.pathname, query: { ...newQuery } });
      return;
    }

    router.replace({
      pathname: router.pathname,
      query: { ...router.query, page: page - 1 },
    });
  }, [page, router]);

  const handleItemsPerPageSelection = useCallback(
    (itemsPerPage: number) => {
      dispatch({ type: "itemsPerPage", payload: { itemsPerPage } });
    },
    [dispatch]
  );

  const handleNFTSelect = useCallback(
    (selectedNFT: string) => {
      const newPubkey = toPublicKey(selectedNFT);
      const idx = state.selectedNFTs.findIndex((nft) => nft.equals(newPubkey));
      if (idx >= 0) {
        const newItems = state.selectedNFTs.filter(
          (nft) => !nft.equals(newPubkey)
        );
        dispatch({ type: "selectedNFTs", payload: { selectedNFTs: newItems } });
      } else {
        const newItems = [...state.selectedNFTs, newPubkey];
        dispatch({ type: "selectedNFTs", payload: { selectedNFTs: newItems } });
      }
    },
    [state.selectedNFTs]
  );

  const handleNFTUnselect = useCallback(
    (mint: PublicKey) => {
      const newItems = state.selectedNFTs.filter((nft) => !nft.equals(mint));
      dispatch({ type: "selectedNFTs", payload: { selectedNFTs: newItems } });
    },
    [state.selectedNFTs]
  );

  const removeNFT = useCallback(
    (nft: PublicKey) => {
      dispatch({
        type: "nfts",
        payload: {
          nfts: state.nfts.filter((i) => !toPublicKey(i.mint).equals(nft)),
        },
      });
    },
    [state.nfts]
  );

  const handleBurn = useCallback(async () => {
    if (!publicKey || !state.selectedNFTs) {
      return;
    }

    try {
      dispatch({ type: "burning" });
      let counter = 1;
      for (const mint of state.selectedNFTs) {
        setAlertState({
          message: (
            <>
              <button className="mr-2 btn btn-ghost loading" />
              <div className="flex-1">
                {" "}
                Burning {counter} of {state.selectedNFTs.length} NFTs
              </div>
            </>
          ),
          open: true,
        });
        const mintAssociatedAccountAddress = await getAssociatedTokenAddress(
          mint,
          publicKey,
          false
        );
        const instruction = createBurnInstruction(
          mintAssociatedAccountAddress,
          mint,
          publicKey,
          1,
          []
        );

        const closeIx = createCloseAccountInstruction(
          mintAssociatedAccountAddress,
          publicKey,
          publicKey,
          []
        );
        const transaction = new Transaction().add(instruction, closeIx);
        transaction.recentBlockhash = (
          await getBlockhashWithRetries(connection)
        ).blockhash;
        transaction.feePayer = publicKey;
        await signTransaction(transaction);

        let tries = 0;
        let completed = false;
        while (!completed) {
          try {
            const signature = await connection.sendRawTransaction(
              transaction.serialize()
            );
            await connection.confirmTransaction(signature, "processed");
            dispatch({ type: "burned" });
            removeNFT(mint);
            handleNFTUnselect(mint);
            completed = true;
          } catch (e) {
            console.error(e);
            await new Promise((resolve) => setTimeout(resolve, 500));
            tries += 1;
            if (tries >= 6) {
              dispatch({ type: "burned" });
              completed = true;
              setModalState({
                open: true,
                message: "Error trying to send transaction!",
              });
            }
          }
        }
      }

      setAlertState({
        message: <></>,
        open: false,
      });
      setModalState({
        open: true,
        message: "Burned all NFTs!",
      });
    } catch (err) {
      setModalState({
        message: err.message,
        open: true,
      });
      setAlertState({
        open: false,
      });
      dispatch({ type: "burned" });
    }
  }, [
    publicKey,
    state,
    removeNFT,
    handleNFTUnselect,
    connection,
    signTransaction,
    setAlertState,
    setModalState,
  ]);

  const confirmationModal = useMemo(() => {
    return state.isModalOpen && document.body
      ? createPortal(
          <div className="flex fixed inset-0 justify-center items-center p-4 bg-black bg-opacity-75">
            <div className="p-4 w-full max-w-sm bg-gray-800 rounded-lg shadow-lg">
              <p className="text-2xl text-center text-white">
                Are you sure you want to permanently destroy{" "}
                {`${
                  state.selectedNFTs.length === 1
                    ? "this NFT"
                    : ` these ${state.selectedNFTs.length} NFTs?`
                }`}
                ?
                <br />
                <br />
                <strong>
                  It cannot be undone and they will be destroyed!!! Make sure
                  you know what you are doing!
                </strong>
              </p>

              <div className="flex justify-center items-center p-4 mt-8 w-full">
                <button
                  type="button"
                  className="mr-4 btn rounded-box"
                  onClick={() => {
                    dispatch({
                      type: "isModalOpen",
                      payload: { isModalOpen: false },
                    });
                  }}
                >
                  nope
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "isModalOpen",
                      payload: { isModalOpen: false },
                    });
                    handleBurn();
                  }}
                  className={`btn rounded-box btn-primary ${
                    state.isBurning ? "loading" : ""
                  }`}
                >
                  {state.isBurning ? "burning!!" : "yup"}
                </button>
              </div>
            </div>
          </div>,
          document.querySelector("body")
        )
      : null;
  }, [state, handleNFTUnselect, handleBurn]);

  const itemsPerPageSelectionDisplay = useMemo(() => {
    const options = [12, 24, 120];

    return (
      <div className="flex justify-center items-center mt-8 w-full">
        <p className="mr-2">Items per page:</p>
        <div className="flex">
          {options.map((opt, index) => (
            <div key={opt}>
              <button
                type="button"
                onClick={() => handleItemsPerPageSelection(opt)}
                disabled={opt === itemsPerPage}
                className={opt === itemsPerPage ? "" : "underline"}
              >
                {opt}
              </button>
              {index < options.length - 1 ? (
                <span className="mx-2">|</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }, [itemsPerPage, handleItemsPerPageSelection]);

  const paginationDisplay = useMemo(() => {
    return state.nfts.length > itemsPerPage ? (
      <div className="flex justify-between items-center m-auto mt-8 w-full max-w-md">
        <button
          type="button"
          className="shadow btn rounded-box"
          onClick={handlePrevPage}
          disabled={page < 2}
        >
          <i className="">
            <LeftIcon />
          </i>
        </button>
        <div className="text-xl text-center text-white">
          {page} / {/* trying maffs */}
          {state.nfts?.length % itemsPerPage === 0
            ? state.nfts?.length / itemsPerPage
            : Math.floor(state.nfts?.length / itemsPerPage) + 1}
        </div>
        <button
          type="button"
          className="shadow btn rounded-box"
          onClick={handleNextPage}
          disabled={
            page >=
            (state.nfts?.length % itemsPerPage === 0
              ? state.nfts?.length / itemsPerPage
              : Math.floor(state.nfts?.length / itemsPerPage) + 1)
          }
        >
          <i className="">
            <RightIcon />
          </i>
        </button>
      </div>
    ) : null;
  }, [state.nfts, itemsPerPage, page, handlePrevPage, handleNextPage]);

  useEffect(() => {
    if (publicKey && state.status === "idle") {
      handleNFTs();
    }
  }, [publicKey, state, handleNFTs]);

  const nftDisplay = useMemo(() => {
    if (["idle", "pending"].includes(state.status)) {
      return (
        <p className="text-lg text-center text-white">
          <button className="btn btn-ghost loading"></button>
          fetching NFTs...
        </p>
      );
    }

    return state.status === "rejected" ? (
      <p className="text-lg text-center text-white">
        There was an error fetching your NFTS :(
      </p>
    ) : (
      <>
        <div>
          {state.nfts.length === 0 ? (
            <p className="text-lg text-center text-white">
              You have no NFTs : (
            </p>
          ) : (
            <div className="flex flex-wrap items-center">
              {nftsToRender?.map((nft) => (
                <div
                  className="p-2 w-1/2 sm:w-1/3 md:w-1/4"
                  id={nft.mint}
                  key={nft.mint}
                >
                  <NFTPreview
                    nft={nft}
                    selectable
                    handleNFTSelect={handleNFTSelect}
                    selected={
                      !!state.selectedNFTs.find((n) =>
                        n.equals(toPublicKey(nft.mint))
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="mt-2 rounded-full shadow btn btn-primary"
          disabled={!state.selectedNFTs.length}
          onClick={() => {
            dispatch({ type: "isModalOpen", payload: { isModalOpen: true } });
          }}
        >
          {state.selectedNFTs.length
            ? `burn ${state.selectedNFTs.length} items`
            : "selecc to burn"}{" "}
          <i className="ml-3">
            <FireIcon />
          </i>
        </button>
        {paginationDisplay}
        {itemsPerPageSelectionDisplay}
      </>
    );
  }, [
    state,
    itemsPerPageSelectionDisplay,
    paginationDisplay,
    nftsToRender,
    handleNFTSelect,
  ]);

  return (
    <>
      <Head>
        <title>🛠️ Pentacle Tools - 🔥 Burn NFTs</title>
      </Head>
      <div className="mb-3 w-full max-w-full text-center">
        <h2 className="text-3xl text-white">Burn NFTs</h2>
        <hr className="my-4 opacity-10" />
      </div>
      <p className="px-2 text-center">
        This tool facilitates the destruction of NFTs that the connected wallet
        owns. It also releases the rent (ca 0.002 SOL per NFT)
      </p>
      <div className="flex flex-col justify-center items-center my-4 text-sm">
        {publicKey ? (
          <p className="text-center text-white break-all">
            <span>Connected Address:</span>
            <br />

            <CopyToClipboard
              text={state.publicAddress}
              onCopy={() =>
                setAlertState({
                  message: "Copied to clipboard!",
                  duration: 2000,
                  open: true,
                })
              }
            >
              <span className={`cursor-pointer`}>{state.publicAddress}</span>
            </CopyToClipboard>
          </p>
        ) : (
          <WalletMultiButton
            style={{
              fontSize: "0.75rem",
              height: "2rem",
            }}
          />
        )}
      </div>
      <hr className="my-4 opacity-10" />
      {publicKey ? (
        <div className="p-4 bg-gray-900 shadow card">{nftDisplay}</div>
      ) : null}
      {confirmationModal}
    </>
  );
}
