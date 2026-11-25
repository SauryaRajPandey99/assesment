export type Address = {
  street: string;
  city: string;
  zipcode: string;
  state?: string | null;
};

export type Addresses = {
  [key: string]: Address;
};

export type Args = {
  username: string;
};

export type CreateAddressArgs = Args & {
  address: Address;
};
