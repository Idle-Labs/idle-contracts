pragma solidity 0.5.16;

interface CHAI {
  function dai(address usr) external returns (uint wad);
  // wad is denominated in dai
  function join(address dst, uint wad) external;
  // wad is denominated in (1/chi) * dai
  function exit(address src, uint wad) external;
}
